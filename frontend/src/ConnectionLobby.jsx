import { useState } from 'react';
import './ConnectionLobby.css';

const ConnectionLobby = ({ onJoinRoom }) => {
  const [roomId, setRoomId] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(0);
  const [gameMode, setGameMode] = useState('4-player');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinRoom = () => {
    if (!roomId.trim()) {
      alert('Please enter a room ID');
      return;
    }

    setIsJoining(true);
    onJoinRoom(roomId.trim(), selectedPlayer, gameMode);
  };

  const generateRandomRoomId = () => {
    const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(randomId);
  };

  return (
    <div className="connection-lobby">
      <div className="lobby-container">
        <h1>Finnie AI Card Game</h1>
        <h2>Multiplayer Lobby</h2>
        
        <div className="connection-form">
          <div className="form-group">
            <label>Game Mode:</label>
            <div className="game-mode-selection">
              <div
                className={`mode-option ${gameMode === '4-player' ? 'selected' : ''}`}
                onClick={() => {
                  if (!isJoining) {
                    setGameMode('4-player');
                    if (selectedPlayer >= 4) setSelectedPlayer(0);
                  }
                }}
              >
                <div className="mode-title">4-Player (Teams)</div>
                <div className="mode-description">Traditional team play with 7 cards each</div>
              </div>
              <div
                className={`mode-option ${gameMode === '2-player' ? 'selected' : ''}`}
                onClick={() => {
                  if (!isJoining) {
                    setGameMode('2-player');
                    if (selectedPlayer >= 2) setSelectedPlayer(0);
                  }
                }}
              >
                <div className="mode-title">2-Player</div>
                <div className="mode-description">Head-to-head with 9 cards each</div>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="roomId">Room ID:</label>
            <div className="room-input-container">
              <input
                type="text"
                id="roomId"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="Enter room ID"
                maxLength={8}
                disabled={isJoining}
              />
              <button 
                type="button" 
                onClick={generateRandomRoomId}
                disabled={isJoining}
                className="generate-button"
              >
                Generate
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Choose Your Player Position:</label>
            <div className="player-selection">
              {Array.from({ length: gameMode === '2-player' ? 2 : 4 }, (_, playerIndex) => (
                <div
                  key={playerIndex}
                  className={`player-option ${selectedPlayer === playerIndex ? 'selected' : ''}`}
                  onClick={() => !isJoining && setSelectedPlayer(playerIndex)}
                >
                  <div className="player-number">{playerIndex + 1}</div>
                  <div className="player-position-name">
                    {gameMode === '2-player' 
                      ? (playerIndex === 0 ? 'Player 1 (You)' : 'Player 2')
                      : (playerIndex === 0 ? 'South (You)' :
                         playerIndex === 1 ? 'West' :
                         playerIndex === 2 ? 'North (Teammate)' :
                         'East')
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleJoinRoom}
            disabled={!roomId.trim() || isJoining}
            className="join-button"
          >
            {isJoining ? 'Connecting...' : 'Join Room'}
          </button>
        </div>

        <div className="game-info">
          <h3>How to Play:</h3>
          <ul>
            {gameMode === '2-player' ? (
              <>
                <li>2 players needed to start a game</li>
                <li>Head-to-head play, no teams</li>
                <li>Each player gets 9 cards</li>
                <li>2 odd cards (instead of 4) void a trick</li>
                <li>Share your room ID with the other player</li>
                <li>Game starts automatically when both players join</li>
              </>
            ) : (
              <>
                <li>4 players needed to start a game</li>
                <li>Players across from each other are teammates</li>
                <li>Each player gets 7 cards</li>
                <li>4 odd cards void a trick</li>
                <li>Share your room ID with other players</li>
                <li>Each player chooses a different position (1-4)</li>
                <li>Game starts automatically when all 4 players join</li>
              </>
            )}
          </ul>

          <div className="network-info">
            <h3>Connection Info:</h3>
            <p>Server: ws://localhost:8080</p>
            <p>Make sure the server is running before joining</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionLobby;