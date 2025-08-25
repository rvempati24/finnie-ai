import { useState, useEffect, useRef } from 'react';

export const useWebSocket = (roomId, playerIndex, gameMode) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [connectedPlayers, setConnectedPlayers] = useState([]);
  const [error, setError] = useState(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    if (!roomId || playerIndex === null || playerIndex === undefined || !gameMode) return;

    const connect = () => {
      try {
        const ws = new WebSocket('ws://localhost:8080');
        
        ws.onopen = () => {
          console.log('Connected to WebSocket server');
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0;
          
          // Join room
          ws.send(JSON.stringify({
            type: 'joinRoom',
            roomId,
            playerIndex,
            gameMode
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
              case 'joined':
                setGameState(data.gameState);
                setConnectedPlayers(data.connectedPlayers);
                break;
              case 'gameState':
                setGameState(data.gameState);
                setConnectedPlayers(data.connectedPlayers);
                break;
              case 'error':
                setError(data.message);
                break;
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          console.log('Disconnected from WebSocket server');
          setIsConnected(false);
          setSocket(null);
          
          // Attempt to reconnect
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          } else {
            setError('Failed to connect after multiple attempts');
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setError('Connection error');
        };

        setSocket(ws);
        
      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        setError('Failed to create connection');
      }
    };

    connect();

    // Cleanup
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [roomId, playerIndex, gameMode]);

  const sendAction = (action) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'playerAction',
        action
      }));
    } else {
      console.warn('WebSocket not connected');
      setError('Not connected to server');
    }
  };

  return {
    isConnected,
    gameState,
    connectedPlayers,
    error,
    sendAction
  };
};