# Finnie AI Card Game - Multiplayer Setup

This is the multiplayer version of the Finnie AI card game that allows up to 4 players to connect and play together over a network.

## Prerequisites

- Node.js (version 16 or higher)
- npm (comes with Node.js)

## Installation

1. Navigate to the frontend directory:
   ```bash
   cd finnie-ai/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Game

### Step 1: Start the WebSocket Server

In one terminal, start the WebSocket server:
```bash
npm run server
```

The server will start on `ws://localhost:8080`

### Step 2: Start the Frontend Development Server

In another terminal, start the Vite development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## How to Play Multiplayer

1. **Create/Join a Room:**
   - Open the game in your browser
   - Enter a Room ID (or generate one)
   - Choose your player position (1-4)
   - Share the Room ID with other players

2. **Player Positions:**
   - **Player 1 (South):** Bottom position - your cards are visible
   - **Player 2 (West):** Left position 
   - **Player 3 (North):** Top position - your teammate
   - **Player 4 (East):** Right position

3. **Teams:**
   - **Team 1:** Player 1 & Player 3 (North-South)
   - **Team 2:** Player 2 & Player 4 (East-West)

4. **Game Flow:**
   - Wait for all 4 players to connect
   - Game starts automatically when everyone joins
   - Follow the same rules as the single-player version

## Network Setup for Multiple Machines

### For LAN Play:

1. **Find your local IP address:**
   - Windows: `ipconfig` (look for IPv4 Address)
   - Mac/Linux: `ifconfig` or `ip addr`

2. **Update the WebSocket connection:**
   - Edit `src/useWebSocket.js`
   - Change `ws://localhost:8080` to `ws://YOUR_IP_ADDRESS:8080`

3. **Allow connections through firewall:**
   - Windows: Allow Node.js through Windows Defender Firewall
   - Mac: System Preferences > Security & Privacy > Firewall
   - Linux: Configure iptables or ufw as needed

### For Internet Play:

1. **Port Forwarding:**
   - Forward port 8080 on your router to your computer
   - Update WebSocket URL to use your public IP

2. **Alternative: Use ngrok (easier for testing):**
   ```bash
   npm install -g ngrok
   ngrok tcp 8080
   ```
   Use the provided ngrok URL in the WebSocket connection

## Troubleshooting

### Common Issues:

1. **Connection Failed:**
   - Make sure the WebSocket server is running
   - Check firewall settings
   - Verify the correct IP address/port

2. **Player Slot Already Taken:**
   - Each player must choose a different position (1-4)
   - Try refreshing the page if someone disconnected

3. **Game Not Starting:**
   - Ensure all 4 players are connected
   - Check that everyone is in the same room

4. **Cards Not Visible:**
   - Only your own cards are visible by design
   - Other players' cards show as card backs for game integrity

### Performance Tips:

- Close unnecessary browser tabs
- Use a stable network connection
- Consider using wired internet for competitive play

## Game Rules

The multiplayer version follows the same rules as the single-player game:

- **Bidding:** Players bid on how many tricks their team will win
- **Trump Selection:** Winner of bidding chooses trump suit and ranking
- **Mulligan:** Exchange unwanted cards
- **Trick-taking:** Follow suit if possible, trump cards win
- **Scoring:** First team to 21 points wins
- **Special Rule:** If all 4 cards in a trick are odd (3,5,7,9,J,K,A), the trick is discarded

## Development

### Project Structure:
```
frontend/
├── src/
│   ├── App.jsx              # Main game component
│   ├── useWebSocket.js      # WebSocket hook
│   ├── ConnectionLobby.jsx  # Room joining interface
│   └── ConnectionLobby.css  # Lobby styles
├── server.js                # WebSocket server
└── package.json             # Dependencies and scripts
```

### Adding Features:
- Server logic is in `server.js`
- Client logic is in React components
- WebSocket communication uses JSON messages
- Game state is synchronized across all clients

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify server logs in the terminal
3. Test with localhost first before network play
4. Make sure all players are using the same version