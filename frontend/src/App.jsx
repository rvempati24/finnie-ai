import { useState, useEffect } from 'react'
import './App.css'
import { useWebSocket } from './useWebSocket'
import ConnectionLobby from './ConnectionLobby'

// Game phases - updated to match server
const GAME_PHASES = {
  WAITING: 'waiting',
  SETUP: 'setup',
  DEALING: 'dealing',
  BIDDING: 'bidding',
  TRUMP_SELECTION: 'trump_selection',
  MULLIGAN: 'mulligan',
  PLAYING: 'playing',
  ROUND_END: 'round_end',
  GAME_END: 'game_end'
}

// Card ranking orders
const HIGH_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const LOW_ORDER = ['K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

// Odd cards for special rule
const ODD_CARDS = ['3', '5', '7', '9', 'J', 'K', 'A']

// Card component
const Card = ({ card, isVisible = true, isPlayable = false, onClick, isSelected = false }) => {
  if (!isVisible) {
    return (
      <div className="card card-back" onClick={onClick}>
        <div className="card-inner">
          <div className="card-back-pattern"></div>
        </div>
      </div>
    )
  }

  const isRedSuit = card.suit === '♥' || card.suit === '♦'

  return (
    <div 
      className={`card ${isPlayable ? 'playable' : ''} ${isSelected ? 'selected' : ''}`} 
      onClick={isPlayable ? onClick : undefined}
    >
      <div className="card-inner">
        <div className={`card-value ${isRedSuit ? 'red' : ''}`}>{card.value}</div>
        <div className={`card-suit ${isRedSuit ? 'red' : ''}`}>{card.suit}</div>
      </div>
    </div>
  )
}

// Bidding component
const BiddingPanel = ({ gameState, playerIndex, onBid }) => {
  if (gameState.phase !== GAME_PHASES.BIDDING) return null

  const isYourTurn = gameState.currentPlayerIndex === playerIndex

  return (
    <div className="bidding-panel">
      <h3>Bidding Phase</h3>
      <p>Current highest bid: {gameState.highestBid}</p>
      <div className="player-bids">
        {gameState.players.map((player, index) => (
          <div key={index} className="player-bid">
            {player.name}: {player.bid === null ? 'Not bid' : player.bid === 0 ? 'Passed' : player.bid}
          </div>
        ))}
      </div>
      {isYourTurn && (
        <div className="bid-buttons">
          <button onClick={() => onBid(0)}>Pass</button>
          {[1, 2, 3, 4, 5, 6, 7].map(bid => (
            <button 
              key={bid} 
              onClick={() => onBid(bid)}
              disabled={bid <= gameState.highestBid}
            >
              {bid}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Trump selection component
const TrumpSelectionPanel = ({ gameState, playerIndex, onTrumpSelection }) => {
  if (gameState.phase !== GAME_PHASES.TRUMP_SELECTION) return null

  const isYourTurn = gameState.currentPlayerIndex === playerIndex

  return (
    <div className="trump-panel">
      <h3>Trump Selection</h3>
      <p>You won the bid with {gameState.highestBid}! Choose trump suit and ranking:</p>
      {isYourTurn && (
        <>
          <div className="trump-suits">
            <h4>Choose Trump Suit:</h4>
            <button onClick={() => onTrumpSelection('♠', 'high')}>♠ High</button>
            <button onClick={() => onTrumpSelection('♠', 'low')}>♠ Low</button>
            <button onClick={() => onTrumpSelection('♥', 'high')}>♥ High</button>
            <button onClick={() => onTrumpSelection('♥', 'low')}>♥ Low</button>
            <button onClick={() => onTrumpSelection('♦', 'high')}>♦ High</button>
            <button onClick={() => onTrumpSelection('♦', 'low')}>♦ Low</button>
            <button onClick={() => onTrumpSelection('♣', 'high')}>♣ High</button>
            <button onClick={() => onTrumpSelection('♣', 'low')}>♣ Low</button>
            <button onClick={() => onTrumpSelection(null, 'high')}>No Trump High</button>
            <button onClick={() => onTrumpSelection(null, 'low')}>No Trump Low</button>
          </div>
        </>
      )}
    </div>
  )
}

// Mulligan component
const MulliganPanel = ({ gameState, playerIndex, onConfirmMulligan }) => {
  if (gameState.phase !== GAME_PHASES.MULLIGAN) return null

  const currentPlayer = gameState.players[gameState.currentPlayerIndex]
  const isYourTurn = gameState.currentPlayerIndex === playerIndex

  return (
    <div className="mulligan-panel">
      <h3>Mulligan Phase</h3>
      <p>Trump: {gameState.trumpSuit || 'No Trump'} ({gameState.rankingOrder})</p>
      <p>Select cards to discard and get new ones:</p>
      {isYourTurn && (
        <>
          <p>Selected: {currentPlayer.selectedCards.length} cards</p>
          <button onClick={onConfirmMulligan}>Confirm Exchange</button>
        </>
      )}
    </div>
  )
}

// Player component
const Player = ({ player, isCurrentPlayer, isTeammate, cards, onCardClick, gameState, playerIndex, currentPlayerIndex }) => {
  const isYourCards = playerIndex === currentPlayerIndex
  const canPlay = gameState.phase === GAME_PHASES.PLAYING && isCurrentPlayer
  const canSelect = gameState.phase === GAME_PHASES.MULLIGAN && isCurrentPlayer

  return (
    <div className={`player ${isCurrentPlayer ? 'current' : ''} ${isTeammate ? 'teammate' : ''}`}>
      <div className="player-info">
        <h3>{player.name}</h3>
        <div className="player-status">
          {player.bid !== null && <span>Bid: {player.bid === 0 ? 'Pass' : player.bid}</span>}
          {isCurrentPlayer && gameState.phase === GAME_PHASES.BIDDING && ' - Bidding'}
          {isCurrentPlayer && gameState.phase === GAME_PHASES.TRUMP_SELECTION && ' - Choose Trump'}
          {isCurrentPlayer && gameState.phase === GAME_PHASES.MULLIGAN && ' - Mulligan'}
          {isCurrentPlayer && gameState.phase === GAME_PHASES.PLAYING && ' - Your Turn'}
          {isTeammate ? ' (Teammate)' : ''}
        </div>
      </div>
      <div className="player-cards">
        {cards.map((card, index) => (
          <Card
            key={index}
            card={card}
            isVisible={isYourCards}
            isPlayable={canPlay || canSelect}
            isSelected={canSelect && player.selectedCards?.includes(index)}
            onClick={() => onCardClick(index)}
          />
        ))}
      </div>
    </div>
  )
}

// Game table component
const GameTable = ({ gameState, playerIndex, onCardPlay, onCardSelection }) => {
  const { players, currentPlayerIndex, currentTrick } = gameState

  const handleCardClick = (cardIndex) => {
    if (gameState.phase === GAME_PHASES.PLAYING) {
      onCardPlay(cardIndex)
    } else if (gameState.phase === GAME_PHASES.MULLIGAN) {
      onCardSelection(cardIndex)
    }
  }

  // Calculate player positions from current player's perspective
  // Current player is always at bottom, others arranged clockwise
  const getPlayerPosition = (actualPlayerIndex) => {
    const positions = ['bottom', 'left', 'top', 'right']
    const offset = (actualPlayerIndex - playerIndex + 4) % 4
    return positions[offset]
  }

  const getTeammateStatus = (actualPlayerIndex) => {
    // Team assignments: players 0&2 vs players 1&3
    const currentPlayerTeam = playerIndex % 2
    const otherPlayerTeam = actualPlayerIndex % 2
    return currentPlayerTeam === otherPlayerTeam
  }

  return (
    <div className="game-table">
      {/* Game info moved to top-left corner */}
      <div className="game-info">
        <p>Round {gameState.currentRound}</p>
        <p>Team 1: {gameState.scores.team1} | Team 2: {gameState.scores.team2}</p>
        <p>Tricks: {gameState.tricksWon.team1}-{gameState.tricksWon.team2}</p>
        {gameState.trumpSuit && (
          <p>Trump: {gameState.trumpSuit} ({gameState.rankingOrder})</p>
        )}
        {gameState.winningBidder !== null && (
          <p>Bid: {gameState.highestBid} by {players[gameState.winningBidder]?.name}</p>
        )}
      </div>
      
      {/* Center area for played cards in circular layout */}
      <div className="table-center">
        <div className="played-cards-circle">
          {currentTrick.map((trickCard, index) => {
            const position = getPlayerPosition(trickCard.playerIndex)
            return (
              <div key={index} className={`played-card-position ${position}`}>
                <Card card={trickCard.card} />
              </div>
            )
          })}
        </div>
      </div>
      
      <div className="players-container">
        {players.map((player, actualPlayerIndex) => {
          const position = getPlayerPosition(actualPlayerIndex)
          const isTeammate = getTeammateStatus(actualPlayerIndex)
          
          return (
            <div key={actualPlayerIndex} className={`player-position ${position}`}>
              <Player
                player={player}
                isCurrentPlayer={currentPlayerIndex === actualPlayerIndex}
                isTeammate={isTeammate}
                cards={player?.cards || []}
                onCardClick={handleCardClick}
                gameState={gameState}
                playerIndex={actualPlayerIndex}
                currentPlayerIndex={playerIndex}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function App() {
  const [roomId, setRoomId] = useState(null);
  const [playerIndex, setPlayerIndex] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  
  const { isConnected, gameState, connectedPlayers, error, sendAction } = useWebSocket(roomId, playerIndex);

  const handleJoinRoom = (newRoomId, newPlayerIndex) => {
    setRoomId(newRoomId);
    setPlayerIndex(newPlayerIndex);
    setConnectionError(null);
  };

  // Show connection error or WebSocket error
  useEffect(() => {
    if (error) {
      setConnectionError(error);
    }
  }, [error]);

  // WebSocket action handlers
  const handleStartGame = () => {
    sendAction({ type: 'startGame' });
  };

  const handleBid = (bidAmount) => {
    sendAction({ type: 'bid', bidAmount });
  };

  const handleTrumpSelection = (suit, order) => {
    sendAction({ type: 'trumpSelection', suit, order });
  };

  const handleCardSelection = (cardIndex) => {
    sendAction({ type: 'cardSelection', cardIndex });
  };

  const confirmMulligan = () => {
    sendAction({ type: 'confirmMulligan' });
  };

  const handleCardPlay = (cardIndex) => {
    sendAction({ type: 'playCard', cardIndex });
  };

  const startNextRound = () => {
    sendAction({ type: 'startNextRound' });
  };

  const startNewGame = () => {
    sendAction({ type: 'startNewGame' });
  };

  const handleDisconnect = () => {
    setRoomId(null);
    setPlayerIndex(null);
    setConnectionError(null);
  };

  // Show connection lobby if not connected to a room
  if (!roomId || !isConnected) {
    return (
      <div>
        <ConnectionLobby onJoinRoom={handleJoinRoom} />
        {connectionError && (
          <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: 'rgba(255, 0, 0, 0.8)',
            color: 'white',
            padding: '1rem',
            borderRadius: '10px',
            zIndex: 1000
          }}>
            Error: {connectionError}
            <button 
              onClick={() => setConnectionError(null)}
              style={{ marginLeft: '10px', background: 'transparent', border: '1px solid white', color: 'white', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        )}
      </div>
    );
  }

  // Show loading while waiting for game state
  if (!gameState) {
    return (
      <div className="app">
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          color: 'white'
        }}>
          <h2>Connecting to game...</h2>
          <p>Room: {roomId} | Player: {playerIndex + 1}</p>
          <button 
            onClick={handleDisconnect}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid white',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Finnie AI Card Game - Multiplayer</h1>
        <div style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '1rem' }}>
          Room: {roomId} | You are Player {playerIndex + 1} | Connected: {connectedPlayers.length}/4
          <button 
            onClick={handleDisconnect}
            style={{
              marginLeft: '1rem',
              padding: '0.3rem 0.8rem',
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid white',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            Leave Room
          </button>
        </div>
        
        {gameState.phase === GAME_PHASES.SETUP && connectedPlayers.length === 4 && (
          <button className="start-button" onClick={handleStartGame}>
            {gameState.currentRound === 1 ? 'Start New Game' : 'Deal Cards'}
          </button>
        )}
        {gameState.phase === GAME_PHASES.ROUND_END && (
          <button className="start-button" onClick={startNextRound}>
            Start Next Round
          </button>
        )}
        {gameState.phase === GAME_PHASES.GAME_END && (
          <button className="start-button" onClick={startNewGame}>
            Start New Game
          </button>
        )}
      </header>
      
      <main className="app-main">
        {connectionError && (
          <div style={{
            background: 'rgba(255, 0, 0, 0.2)',
            color: '#ff6b6b',
            padding: '1rem',
            borderRadius: '10px',
            textAlign: 'center',
            marginBottom: '1rem',
            border: '2px solid #ff6b6b'
          }}>
            Connection Error: {connectionError}
          </div>
        )}
        
        {gameState.message && (
          <div className="game-message">
            {gameState.message}
          </div>
        )}
        
        <BiddingPanel 
          gameState={gameState}
          playerIndex={playerIndex}
          onBid={handleBid}
        />
        
        <TrumpSelectionPanel
          gameState={gameState}
          playerIndex={playerIndex}
          onTrumpSelection={handleTrumpSelection}
        />
        
        <MulliganPanel
          gameState={gameState}
          playerIndex={playerIndex}
          onConfirmMulligan={confirmMulligan}
        />
        
        {gameState.phase === GAME_PHASES.WAITING ? (
          <div className="welcome-screen">
            <h2>Waiting for Players</h2>
            <p>Connected Players: {connectedPlayers.length}/4</p>
            <div style={{ margin: '1rem 0' }}>
              {[0, 1, 2, 3].map(index => (
                <div 
                  key={index} 
                  style={{
                    display: 'inline-block',
                    margin: '0.5rem',
                    padding: '0.5rem',
                    background: connectedPlayers.includes(index) ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '5px',
                    border: index === playerIndex ? '2px solid #ffd700' : '1px solid rgba(255, 255, 255, 0.3)'
                  }}
                >
                  Player {index + 1} {index === playerIndex ? '(You)' : ''}: {connectedPlayers.includes(index) ? 'Connected' : 'Waiting...'}
                </div>
              ))}
            </div>
            <p>Share room ID <strong>{roomId}</strong> with other players</p>
            <p>Game will start automatically when all 4 players join</p>
          </div>
        ) : gameState.gameStarted || gameState.phase !== GAME_PHASES.SETUP ? (
          <GameTable 
            gameState={gameState}
            playerIndex={playerIndex}
            onCardPlay={handleCardPlay}
            onCardSelection={handleCardSelection}
          />
        ) : (
          <div className="welcome-screen">
            <h2>Ready to Start!</h2>
            <p>All players connected. Click "Start New Game" to begin!</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
