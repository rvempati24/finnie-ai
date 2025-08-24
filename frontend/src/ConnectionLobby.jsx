import { useState } from 'react';
import './ConnectionLobby.css';

const ConnectionLobby = ({ onJoinRoom }) => {
  const [roomId, setRoomId] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(0);
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinRoom = () => {
    if (!roomId.trim()) {
      alert('Please enter a room ID');
      return;
    }

    setIsJoining(true);
    onJoinRoom(roomId.trim(), selectedPlayer);
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
              {[0, 1, 2, 3].map(playerIndex => (
                <div
                  key={playerIndex}
                  className={`player-option ${selectedPlayer === playerIndex ? 'selected' : ''}`}
                  onClick={() => !isJoining && setSelectedPlayer(playerIndex)}
                >
                  <div className="player-number">{playerIndex + 1}</div>
                  <div className="player-position-name">
                    {playerIndex === 0 ? 'South (You)' :
                     playerIndex === 1 ? 'West' :
                     playerIndex === 2 ? 'North (Teammate)' :
                     'East'}
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
            <li>4 players needed to start a game</li>
            <li>Players across from each other are teammates</li>
            <li>Share your room ID with other players</li>
            <li>Each player chooses a different position (1-4)</li>
            <li>Game starts automatically when all 4 players join</li>
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