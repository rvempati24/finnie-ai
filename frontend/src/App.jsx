import { useState, useEffect } from 'react'
import './App.css'

// Card component
const Card = ({ card, isVisible = true, isPlayable = false, onClick }) => {
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
      className={`card ${isPlayable ? 'playable' : ''}`} 
      onClick={isPlayable ? onClick : undefined}
    >
      <div className="card-inner">
        <div className={`card-value ${isRedSuit ? 'red' : ''}`}>{card.value}</div>
        <div className={`card-suit ${isRedSuit ? 'red' : ''}`}>{card.suit}</div>
      </div>
    </div>
  )
}

// Player component
const Player = ({ player, isCurrentPlayer, isTeammate, cards, onCardClick }) => {
  return (
    <div className={`player ${isCurrentPlayer ? 'current' : ''} ${isTeammate ? 'teammate' : ''}`}>
      <div className="player-info">
        <h3>{player.name}</h3>
        <div className="player-status">
          {isCurrentPlayer ? 'Your Turn' : ''}
          {isTeammate ? ' (Teammate)' : ''}
        </div>
      </div>
      <div className="player-cards">
        {cards.map((card, index) => (
          <Card
            key={index}
            card={card}
            isVisible={player.isCurrentPlayer}
            isPlayable={isCurrentPlayer && player.isCurrentPlayer}
            onClick={() => onCardClick(index)}
          />
        ))}
      </div>
    </div>
  )
}

// Game table component
const GameTable = ({ gameState, onCardPlay }) => {
  const { players, currentPlayerIndex, playedCards } = gameState

  return (
    <div className="game-table">
      <div className="table-center">
        <div className="played-cards">
          {playedCards.map((card, index) => (
            <Card key={index} card={card} />
          ))}
        </div>
        <div className="game-info">
          <h2>Finnie AI Card Game</h2>
          <p>Current Turn: {players[currentPlayerIndex]?.name}</p>
        </div>
      </div>
      
      <div className="players-container">
        {/* Top player (across from current player) */}
        <div className="player-position top">
          <Player
            player={players[2]}
            isCurrentPlayer={currentPlayerIndex === 2}
            isTeammate={true}
            cards={players[2]?.cards || []}
            onCardClick={onCardPlay}
          />
        </div>
        
        {/* Left player */}
        <div className="player-position left">
          <Player
            player={players[1]}
            isCurrentPlayer={currentPlayerIndex === 1}
            isTeammate={false}
            cards={players[1]?.cards || []}
            onCardClick={onCardPlay}
          />
        </div>
        
        {/* Right player */}
        <div className="player-position right">
          <Player
            player={players[3]}
            isCurrentPlayer={currentPlayerIndex === 3}
            isTeammate={false}
            cards={players[3]?.cards || []}
            onCardClick={onCardPlay}
          />
        </div>
        
        {/* Bottom player (current player) */}
        <div className="player-position bottom">
          <Player
            player={players[0]}
            isCurrentPlayer={currentPlayerIndex === 0}
            isTeammate={false}
            cards={players[0]?.cards || []}
            onCardClick={onCardPlay}
          />
        </div>
      </div>
    </div>
  )
}

function App() {
  const [gameState, setGameState] = useState({
    players: [
      { name: 'You', cards: [], isCurrentPlayer: true },
      { name: 'Player 2', cards: [], isCurrentPlayer: false },
      { name: 'Player 3', cards: [], isCurrentPlayer: false },
      { name: 'Player 4', cards: [], isCurrentPlayer: false }
    ],
    currentPlayerIndex: 0,
    playedCards: [],
    gameStarted: false
  })

  // Generate a deck of cards
  const generateDeck = () => {
    const suits = ['♠', '♥', '♦', '♣']
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
    const deck = []
    
    for (const suit of suits) {
      for (const value of values) {
        deck.push({ suit, value })
      }
    }
    
    return deck
  }

  // Shuffle deck
  const shuffleDeck = (deck) => {
    const shuffled = [...deck]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // Deal cards
  const dealCards = () => {
    const deck = shuffleDeck(generateDeck())
    const players = gameState.players.map((player, index) => ({
      ...player,
      cards: deck.slice(index * 7, (index + 1) * 7)
    }))
    
    setGameState(prev => ({
      ...prev,
      players,
      gameStarted: true
    }))
  }

  // Handle card play
  const handleCardPlay = (playerIndex, cardIndex) => {
    if (playerIndex !== gameState.currentPlayerIndex) return
    
    const player = gameState.players[playerIndex]
    const playedCard = player.cards[cardIndex]
    
    // Remove card from player's hand
    const updatedPlayers = gameState.players.map((p, i) => {
      if (i === playerIndex) {
        return {
          ...p,
          cards: p.cards.filter((_, index) => index !== cardIndex)
        }
      }
      return p
    })
    
    // Add card to played cards
    const updatedPlayedCards = [...gameState.playedCards, playedCard]
    
    // Move to next player
    const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % 4
    
    setGameState(prev => ({
      ...prev,
      players: updatedPlayers,
      currentPlayerIndex: nextPlayerIndex,
      playedCards: updatedPlayedCards
    }))
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Finnie AI Card Game</h1>
        {!gameState.gameStarted && (
          <button className="start-button" onClick={dealCards}>
            Start New Game
          </button>
        )}
      </header>
      
      <main className="app-main">
        {gameState.gameStarted ? (
          <GameTable 
            gameState={gameState} 
            onCardPlay={(cardIndex) => handleCardPlay(gameState.currentPlayerIndex, cardIndex)}
          />
        ) : (
          <div className="welcome-screen">
            <h2>Welcome to Finnie AI Card Game!</h2>
            <p>4 players, 7 cards each. Players across from each other are teammates.</p>
            <p>Click "Start New Game" to begin!</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
