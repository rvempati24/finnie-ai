import { WebSocketServer } from 'ws';

const PORT = 8080;

// Game state and rooms
const rooms = new Map();
const playerConnections = new Map(); // playerId -> { ws, roomId, playerIndex }

class GameRoom {
  constructor(roomId, gameMode = '4-player') {
    this.roomId = roomId;
    this.gameMode = gameMode;
    this.players = new Map(); // playerIndex -> { ws, name, connected }
    
    const isTeamGame = gameMode === '4-player';
    const playerCount = gameMode === '2-player' ? 2 : 4;
    
    // Initialize players array based on game mode
    const players = [];
    for (let i = 0; i < playerCount; i++) {
      players.push({ name: `Player ${i + 1}`, cards: [], isCurrentPlayer: false, bid: null, selectedCards: [] });
    }
    
    this.gameState = {
      phase: 'waiting', // waiting, setup, dealing, bidding, trump_selection, mulligan, playing, round_end, game_end
      gameMode: gameMode,
      players: players,
      currentPlayerIndex: 0,
      dealerIndex: 0,
      biddingPlayerIndex: 1,
      highestBid: 0,
      winningBidder: null,
      trumpSuit: null,
      rankingOrder: 'high',
      currentTrick: [],
      trickWinner: null,
      tricksWon: isTeamGame ? { team1: 0, team2: 0 } : { player1: 0, player2: 0 },
      scores: isTeamGame ? { team1: 0, team2: 0 } : { player1: 0, player2: 0 },
      currentRound: 1,
      deck: [],
      gameStarted: false,
      message: ''
    };
    this.maxPlayers = playerCount;
  }

  addPlayer(ws, playerIndex) {
    if (this.players.size >= this.maxPlayers) {
      return false; // Room is full
    }

    // Validate player index for the current game mode
    if (playerIndex < 0 || playerIndex >= this.maxPlayers) {
      return false; // Invalid player index for this game mode
    }

    this.players.set(playerIndex, {
      ws,
      name: `Player ${playerIndex + 1}`,
      connected: true
    });

    this.gameState.players[playerIndex].name = `Player ${playerIndex + 1}`;
    
    // If room is full, change phase to setup
    if (this.players.size === this.maxPlayers) {
      this.gameState.phase = 'setup';
      this.gameState.message = 'All players connected! Ready to start game.';
    } else {
      this.gameState.message = `Waiting for ${this.maxPlayers - this.players.size} more players...`;
    }

    this.broadcast({
      type: 'gameState',
      gameState: this.gameState,
      connectedPlayers: Array.from(this.players.keys())
    });

    return true;
  }

  removePlayer(playerIndex) {
    if (this.players.has(playerIndex)) {
      this.players.get(playerIndex).connected = false;
      this.players.delete(playerIndex);
      
      // Update game state
      if (this.players.size < this.maxPlayers && this.gameState.phase !== 'waiting') {
        this.gameState.phase = 'waiting';
        this.gameState.message = `Player ${playerIndex + 1} disconnected. Waiting for reconnection...`;
      }

      this.broadcast({
        type: 'gameState',
        gameState: this.gameState,
        connectedPlayers: Array.from(this.players.keys())
      });
    }
  }

  broadcast(message, excludePlayer = null) {
    this.players.forEach((player, playerIndex) => {
      if (player.connected && player.ws.readyState === 1 && playerIndex !== excludePlayer) {
        try {
          player.ws.send(JSON.stringify(message));
        } catch (error) {
          console.error('Error broadcasting to player:', error);
          this.removePlayer(playerIndex);
        }
      }
    });
  }

  sendToPlayer(playerIndex, message) {
    const player = this.players.get(playerIndex);
    if (player && player.connected && player.ws.readyState === 1) {
      try {
        player.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending to player:', error);
        this.removePlayer(playerIndex);
      }
    }
  }

  handlePlayerAction(playerIndex, action) {
    // Validate that it's the correct player's turn for actions that require it
    const requiresTurn = ['bid', 'trumpSelection', 'confirmMulligan', 'playCard'];
    if (requiresTurn.includes(action.type) && this.gameState.currentPlayerIndex !== playerIndex) {
      this.sendToPlayer(playerIndex, {
        type: 'error',
        message: 'It is not your turn'
      });
      return;
    }

    switch (action.type) {
      case 'startGame':
        this.handleStartGame();
        break;
      case 'bid':
        this.handleBid(playerIndex, action.bidAmount);
        break;
      case 'trumpSelection':
        this.handleTrumpSelection(action.suit, action.order);
        break;
      case 'cardSelection':
        this.handleCardSelection(playerIndex, action.cardIndex);
        break;
      case 'confirmMulligan':
        this.handleConfirmMulligan(playerIndex);
        break;
      case 'playCard':
        this.handleCardPlay(playerIndex, action.cardIndex);
        break;
      case 'startNextRound':
        this.handleStartNextRound();
        break;
      case 'startNewGame':
        this.handleStartNewGame();
        break;
    }
  }

  handleStartGame() {
    if (this.gameState.phase !== 'setup' || this.players.size !== this.maxPlayers) return;
    
    // Deal cards logic
    const deck = this.generateDeck();
    const shuffledDeck = this.shuffleDeck(deck);
    
    const cardsPerPlayer = this.gameMode === '2-player' ? 9 : 7;
    const playerCount = this.maxPlayers;
    
    for (let i = 0; i < playerCount; i++) {
      this.gameState.players[i].cards = shuffledDeck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
      this.gameState.players[i].bid = null;
      this.gameState.players[i].selectedCards = [];
    }
    
    this.gameState.deck = shuffledDeck.slice(playerCount * cardsPerPlayer);
    this.gameState.phase = 'bidding';
    this.gameState.biddingPlayerIndex = (this.gameState.dealerIndex + 1) % playerCount;
    this.gameState.currentPlayerIndex = (this.gameState.dealerIndex + 1) % playerCount;
    this.gameState.highestBid = 0;
    this.gameState.winningBidder = null;
    this.gameState.message = `${this.gameState.players[this.gameState.currentPlayerIndex].name}'s turn to bid`;
    this.gameState.gameStarted = true;

    this.broadcast({
      type: 'gameState',
      gameState: this.gameState,
      connectedPlayers: Array.from(this.players.keys())
    });
  }

  generateDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    
    for (const suit of suits) {
      for (const value of values) {
        deck.push({ suit, value });
      }
    }
    
    return deck;
  }

  shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  handleBid(playerIndex, bidAmount) {
    if (this.gameState.phase !== 'bidding') return;
    if (bidAmount !== 0 && bidAmount <= this.gameState.highestBid) return;

    this.gameState.players[playerIndex].bid = bidAmount;

    let newHighestBid = this.gameState.highestBid;
    let newWinningBidder = this.gameState.winningBidder;

    if (bidAmount > this.gameState.highestBid) {
      newHighestBid = bidAmount;
      newWinningBidder = playerIndex;
    }

    this.gameState.highestBid = newHighestBid;
    this.gameState.winningBidder = newWinningBidder;

    // Check if all players have bid
    const allPlayersBid = this.gameState.players.every(p => p.bid !== null);
    
    if (allPlayersBid) {
      // All players passed
      if (newHighestBid === 0) {
        this.gameState.message = 'All players passed! Dealing new hand...';
        this.gameState.phase = 'setup';
        setTimeout(() => this.handleStartGame(), 2000);
        return;
      }

      // Move to trump selection
      this.gameState.phase = 'trump_selection';
      this.gameState.currentPlayerIndex = newWinningBidder;
      this.gameState.message = `${this.gameState.players[newWinningBidder].name} won the bid with ${newHighestBid}! Choose trump suit and ranking.`;
    } else {
      const nextPlayerIndex = (this.gameState.currentPlayerIndex + 1) % this.maxPlayers;
      this.gameState.currentPlayerIndex = nextPlayerIndex;
      this.gameState.message = `${this.gameState.players[nextPlayerIndex].name}'s turn to bid`;
    }

    this.broadcast({
      type: 'gameState',
      gameState: this.gameState,
      connectedPlayers: Array.from(this.players.keys())
    });
  }

  handleTrumpSelection(suit, order) {
    this.gameState.trumpSuit = suit;
    this.gameState.rankingOrder = order;
    this.gameState.phase = 'mulligan';
    this.gameState.currentPlayerIndex = (this.gameState.dealerIndex + 1) % this.maxPlayers;
    this.gameState.message = `Trump: ${suit || 'No Trump'}, ${order} ranking. Mulligan phase: select cards to discard.`;

    this.broadcast({
      type: 'gameState',
      gameState: this.gameState,
      connectedPlayers: Array.from(this.players.keys())
    });
  }

  handleCardSelection(playerIndex, cardIndex) {
    if (this.gameState.phase !== 'mulligan') return;

    const player = this.gameState.players[playerIndex];
    const updatedSelectedCards = player.selectedCards.includes(cardIndex)
      ? player.selectedCards.filter(i => i !== cardIndex)
      : [...player.selectedCards, cardIndex];

    this.gameState.players[playerIndex].selectedCards = updatedSelectedCards;

    this.broadcast({
      type: 'gameState',
      gameState: this.gameState,
      connectedPlayers: Array.from(this.players.keys())
    });
  }

  handleConfirmMulligan(playerIndex) {
    const currentPlayer = this.gameState.players[playerIndex];
    const discardCount = currentPlayer.selectedCards.length;

    // Remove selected cards and add new ones from deck
    const newCards = [...currentPlayer.cards];
    currentPlayer.selectedCards.sort((a, b) => b - a);
    currentPlayer.selectedCards.forEach(index => {
      newCards.splice(index, 1);
    });

    // Add new cards from deck
    const newCardsFromDeck = this.gameState.deck.slice(0, discardCount);
    newCards.push(...newCardsFromDeck);

    this.gameState.players[playerIndex].cards = newCards;
    this.gameState.players[playerIndex].selectedCards = [];
    this.gameState.deck = this.gameState.deck.slice(discardCount);

    const nextPlayerIndex = (this.gameState.currentPlayerIndex + 1) % this.maxPlayers;

    // Check if all players have done mulligan
    if (nextPlayerIndex === (this.gameState.dealerIndex + 1) % this.maxPlayers) {
      // All players done, start trick-taking
      this.gameState.phase = 'playing';
      this.gameState.currentPlayerIndex = this.gameState.winningBidder;
      this.gameState.currentTrick = [];
      this.gameState.message = `${this.gameState.players[this.gameState.winningBidder].name} leads the first trick`;
    } else {
      this.gameState.currentPlayerIndex = nextPlayerIndex;
      this.gameState.message = `${this.gameState.players[nextPlayerIndex].name}'s turn for mulligan`;
    }

    this.broadcast({
      type: 'gameState',
      gameState: this.gameState,
      connectedPlayers: Array.from(this.players.keys())
    });
  }

  handleCardPlay(playerIndex, cardIndex) {
    if (this.gameState.phase !== 'playing') return;

    const player = this.gameState.players[playerIndex];
    const playedCard = player.cards[cardIndex];

    // Check if player must follow suit
    if (this.gameState.currentTrick.length > 0) {
      const leadSuit = this.gameState.currentTrick[0].card.suit;
      const hasLeadSuit = player.cards.some(card => card.suit === leadSuit);
      
      if (hasLeadSuit && playedCard.suit !== leadSuit) {
        this.sendToPlayer(playerIndex, {
          type: 'error',
          message: 'You must follow suit if possible!'
        });
        return;
      }
    }

    // Remove card from player's hand
    this.gameState.players[playerIndex].cards = player.cards.filter((_, index) => index !== cardIndex);

    // Add card to current trick
    this.gameState.currentTrick.push({
      card: playedCard,
      playerIndex: playerIndex
    });

    // Check if trick is complete
    if (this.gameState.currentTrick.length === this.maxPlayers) {
      this.resolveTrick();
    } else {
      // Move to next player
      const nextPlayerIndex = (this.gameState.currentPlayerIndex + 1) % this.maxPlayers;
      this.gameState.currentPlayerIndex = nextPlayerIndex;
      this.gameState.message = `${this.gameState.players[nextPlayerIndex].name}'s turn`;
    }

    this.broadcast({
      type: 'gameState',
      gameState: this.gameState,
      connectedPlayers: Array.from(this.players.keys())
    });
  }

  resolveTrick() {
    // Determine winner
    let trickWinner = this.getTrickWinner(this.gameState.currentTrick);
    
    // Check odd card rule
    if (this.areAllCardsOdd(this.gameState.currentTrick)) {
      // Trick is discarded, but winner still leads next
      this.gameState.currentTrick = [];
      this.gameState.currentPlayerIndex = trickWinner;
      this.gameState.message = `All odd cards! Trick discarded. ${this.gameState.players[trickWinner].name} leads next.`;
      return;
    }

    // Award trick to appropriate scoring entity
    if (this.gameMode === '2-player') {
      if (trickWinner === 0) {
        this.gameState.tricksWon.player1++;
      } else {
        this.gameState.tricksWon.player2++;
      }
    } else {
      // 4-player team mode
      if (trickWinner === 0 || trickWinner === 2) {
        this.gameState.tricksWon.team1++;
      } else {
        this.gameState.tricksWon.team2++;
      }
    }

    // Check if round is over
    const totalTricks = this.gameMode === '2-player' 
      ? this.gameState.tricksWon.player1 + this.gameState.tricksWon.player2
      : this.gameState.tricksWon.team1 + this.gameState.tricksWon.team2;
    const maxTricks = this.gameMode === '2-player' ? 9 : 7;
    if (totalTricks === maxTricks) {
      this.resolveRound();
    } else {
      // Continue with next trick
      this.gameState.currentTrick = [];
      this.gameState.currentPlayerIndex = trickWinner;
      this.gameState.message = `${this.gameState.players[trickWinner].name} wins the trick and leads next`;
    }
  }

  resolveRound() {
    // Round over, calculate scores
    const bidAmount = this.gameState.highestBid;

    if (this.gameMode === '2-player') {
      const biddingPlayer = this.gameState.winningBidder === 0 ? 'player1' : 'player2';
      const otherPlayer = biddingPlayer === 'player1' ? 'player2' : 'player1';

      if (this.gameState.tricksWon[biddingPlayer] >= bidAmount) {
        // Bid made
        this.gameState.scores[biddingPlayer] += this.gameState.tricksWon[biddingPlayer];
        this.gameState.scores[otherPlayer] += this.gameState.tricksWon[otherPlayer];
      } else {
        // Bid failed
        this.gameState.scores[biddingPlayer] -= bidAmount;
        this.gameState.scores[otherPlayer] += this.gameState.tricksWon[otherPlayer];
      }

      // Check for game end
      let targetScore = 21;
      if (this.gameState.scores.player1 > 21 && this.gameState.scores.player2 > 21) {
        targetScore = 31 + (Math.floor(Math.max(this.gameState.scores.player1, this.gameState.scores.player2) / 10) * 10) - 21;
      }

      if (this.gameState.scores.player1 >= targetScore || this.gameState.scores.player2 >= targetScore) {
        const winner = this.gameState.scores.player1 >= targetScore ? 'Player 1' : 'Player 2';
        this.gameState.phase = 'game_end';
        this.gameState.message = `${winner} wins the game! Final score: Player 1: ${this.gameState.scores.player1}, Player 2: ${this.gameState.scores.player2}`;
      } else {
        // Start new round
        this.gameState.phase = 'round_end';
        this.gameState.dealerIndex = (this.gameState.dealerIndex + 1) % this.maxPlayers;
        this.gameState.currentRound++;
        this.gameState.message = `Round ${this.gameState.currentRound - 1} complete! Score: Player 1: ${this.gameState.scores.player1}, Player 2: ${this.gameState.scores.player2}. Click to start next round.`;
      }
    } else {
      // 4-player team mode
      const biddingTeam = this.gameState.winningBidder === 0 || this.gameState.winningBidder === 2 ? 'team1' : 'team2';

      if (this.gameState.tricksWon[biddingTeam] >= bidAmount) {
        // Bid made
        this.gameState.scores[biddingTeam] += this.gameState.tricksWon[biddingTeam];
        this.gameState.scores[biddingTeam === 'team1' ? 'team2' : 'team1'] += this.gameState.tricksWon[biddingTeam === 'team1' ? 'team2' : 'team1'];
      } else {
        // Bid failed
        this.gameState.scores[biddingTeam] -= bidAmount;
        this.gameState.scores[biddingTeam === 'team1' ? 'team2' : 'team1'] += this.gameState.tricksWon[biddingTeam === 'team1' ? 'team2' : 'team1'];
      }

      // Check for game end
      let targetScore = 21;
      if (this.gameState.scores.team1 > 21 && this.gameState.scores.team2 > 21) {
        targetScore = 31 + (Math.floor(Math.max(this.gameState.scores.team1, this.gameState.scores.team2) / 10) * 10) - 21;
      }

      if (this.gameState.scores.team1 >= targetScore || this.gameState.scores.team2 >= targetScore) {
        const winner = this.gameState.scores.team1 >= targetScore ? 'Team 1' : 'Team 2';
        this.gameState.phase = 'game_end';
        this.gameState.message = `${winner} wins the game! Final score: Team 1: ${this.gameState.scores.team1}, Team 2: ${this.gameState.scores.team2}`;
      } else {
        // Start new round
        this.gameState.phase = 'round_end';
        this.gameState.dealerIndex = (this.gameState.dealerIndex + 1) % this.maxPlayers;
        this.gameState.currentRound++;
        this.gameState.message = `Round ${this.gameState.currentRound - 1} complete! Score: Team 1: ${this.gameState.scores.team1}, Team 2: ${this.gameState.scores.team2}. Click to start next round.`;
      }
    }
  }

  getTrickWinner(trick) {
    if (trick.length === 0) return null;

    const leadSuit = trick[0].card.suit;
    let winningCard = trick[0];

    // Check for trump cards first
    const trumpCards = trick.filter(t => this.isTrump(t.card));
    if (trumpCards.length > 0) {
      winningCard = trumpCards.reduce((best, current) => {
        return this.getCardRank(current.card) > this.getCardRank(best.card) ? current : best;
      });
    } else {
      // No trump cards, highest of lead suit wins
      const leadSuitCards = trick.filter(t => t.card.suit === leadSuit);
      if (leadSuitCards.length > 0) {
        winningCard = leadSuitCards.reduce((best, current) => {
          return this.getCardRank(current.card) > this.getCardRank(best.card) ? current : best;
        });
      }
    }

    return winningCard.playerIndex;
  }

  getCardRank(card) {
    const HIGH_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const LOW_ORDER = ['K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
    const order = this.gameState.rankingOrder === 'high' ? HIGH_ORDER : LOW_ORDER;
    return order.indexOf(card.value);
  }

  isTrump(card) {
    return this.gameState.trumpSuit && card.suit === this.gameState.trumpSuit;
  }

  areAllCardsOdd(trick) {
    const ODD_CARDS = ['3', '5', '7', '9', 'J', 'K', 'A'];
    const oddCardsInTrick = trick.filter(t => ODD_CARDS.includes(t.card.value));
    const requiredOddCount = this.gameMode === '2-player' ? 2 : 4;
    return oddCardsInTrick.length === requiredOddCount;
  }

  handleStartNextRound() {
    this.gameState.phase = 'setup';
    this.gameState.tricksWon = this.gameMode === '2-player' ? { player1: 0, player2: 0 } : { team1: 0, team2: 0 };
    this.gameState.currentTrick = [];
    this.gameState.message = 'Click "Start Game" to begin the next round';

    this.broadcast({
      type: 'gameState',
      gameState: this.gameState,
      connectedPlayers: Array.from(this.players.keys())
    });
  }

  handleStartNewGame() {
    const isTeamGame = this.gameMode === '4-player';
    const playerCount = this.maxPlayers;
    
    // Initialize players array based on game mode
    const players = [];
    for (let i = 0; i < playerCount; i++) {
      players.push({ name: `Player ${i + 1}`, cards: [], isCurrentPlayer: false, bid: null, selectedCards: [] });
    }

    this.gameState = {
      phase: 'setup',
      gameMode: this.gameMode,
      players: players,
      currentPlayerIndex: 0,
      dealerIndex: 0,
      biddingPlayerIndex: 1,
      highestBid: 0,
      winningBidder: null,
      trumpSuit: null,
      rankingOrder: 'high',
      currentTrick: [],
      trickWinner: null,
      tricksWon: isTeamGame ? { team1: 0, team2: 0 } : { player1: 0, player2: 0 },
      scores: isTeamGame ? { team1: 0, team2: 0 } : { player1: 0, player2: 0 },
      currentRound: 1,
      deck: [],
      gameStarted: false,
      message: 'All players connected! Ready to start game.'
    };

    this.broadcast({
      type: 'gameState',
      gameState: this.gameState,
      connectedPlayers: Array.from(this.players.keys())
    });
  }
}

// WebSocket server
const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket server running on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'joinRoom':
          handleJoinRoom(ws, data.roomId, data.playerIndex, data.gameMode);
          break;
        case 'playerAction':
          handlePlayerAction(ws, data.action);
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    handlePlayerDisconnect(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function handleJoinRoom(ws, roomId, playerIndex, gameMode = '4-player') {
  // Get or create room
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new GameRoom(roomId, gameMode));
  }
  
  const room = rooms.get(roomId);
  
  // Validate player index
  if (playerIndex < 0 || playerIndex >= room.maxPlayers) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid player index' }));
    return;
  }

  // Check if player slot is already taken
  if (room.players.has(playerIndex)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Player slot already taken' }));
    return;
  }

  // Add player to room
  if (room.addPlayer(ws, playerIndex)) {
    const playerId = `${roomId}-${playerIndex}`;
    playerConnections.set(playerId, { ws, roomId, playerIndex });
    
    // Send initial game state to player
    ws.send(JSON.stringify({
      type: 'joined',
      playerIndex,
      roomId,
      gameState: room.gameState,
      connectedPlayers: Array.from(room.players.keys())
    }));
  } else {
    ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
  }
}

function handlePlayerAction(ws, action) {
  // Find the player connection
  let playerConnection = null;
  for (const [playerId, connection] of playerConnections.entries()) {
    if (connection.ws === ws) {
      playerConnection = connection;
      break;
    }
  }

  if (!playerConnection) {
    ws.send(JSON.stringify({ type: 'error', message: 'Player not found in any room' }));
    return;
  }

  const room = rooms.get(playerConnection.roomId);
  if (room) {
    room.handlePlayerAction(playerConnection.playerIndex, action);
  }
}

function handlePlayerDisconnect(ws) {
  // Find and remove player connection
  let disconnectedPlayer = null;
  for (const [playerId, connection] of playerConnections.entries()) {
    if (connection.ws === ws) {
      disconnectedPlayer = connection;
      playerConnections.delete(playerId);
      break;
    }
  }

  if (disconnectedPlayer) {
    const room = rooms.get(disconnectedPlayer.roomId);
    if (room) {
      room.removePlayer(disconnectedPlayer.playerIndex);
      
      // If room is empty, clean it up
      if (room.players.size === 0) {
        rooms.delete(disconnectedPlayer.roomId);
      }
    }
  }
}