import { Socket } from 'socket.io';
import { SOCKET_EVENTS, ROOMS } from '../socket.events';
import { AuthenticatedSocket } from '../socket.handler';

interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
}

interface TypingUser {
  userId: string;
  userName: string;
  roomId: string;
}

// In-memory storage for demo (in production, use Redis)
const chatMessages: Map<string, ChatMessage[]> = new Map();
const typingUsers: Map<string, Set<TypingUser>> = new Map();

export const chatHandler = (socket: AuthenticatedSocket) => {
  // Send message
  socket.on(SOCKET_EVENTS.SEND_MESSAGE, (data: { roomId: string; content: string }) => {
    if (!socket.user || !data.roomId || !data.content) {
      socket.emit(SOCKET_EVENTS.ERROR, { error: 'Invalid message data' });
      return;
    }

    const message: ChatMessage = {
      id: Date.now().toString(),
      roomId: data.roomId,
      senderId: socket.user.userId,
      senderName: socket.user.email,
      content: data.content,
      timestamp: new Date(),
    };

    // Store message
    if (!chatMessages.has(data.roomId)) {
      chatMessages.set(data.roomId, []);
    }
    chatMessages.get(data.roomId)!.push(message);

    // Broadcast to room
    socket.to(data.roomId).emit(SOCKET_EVENTS.NEW_MESSAGE, message);
    socket.emit(SOCKET_EVENTS.NEW_MESSAGE, message);

    console.log(`Message sent in room ${data.roomId} by ${socket.user.email}`);
  });

  // Handle typing start
  socket.on(SOCKET_EVENTS.TYPING_START, (data: { roomId: string }) => {
    if (!socket.user || !data.roomId) return;

    const typingUser: TypingUser = {
      userId: socket.user.userId,
      userName: socket.user.email,
      roomId: data.roomId,
    };

    if (!typingUsers.has(data.roomId)) {
      typingUsers.set(data.roomId, new Set());
    }

    typingUsers.get(data.roomId)!.add(typingUser);

    // Broadcast typing status
    socket.to(data.roomId).emit(SOCKET_EVENTS.TYPING_START, typingUser);
  });

  // Handle typing stop
  socket.on(SOCKET_EVENTS.TYPING_STOP, (data: { roomId: string }) => {
    if (!socket.user || !data.roomId) return;

    const typingUser: TypingUser = {
      userId: socket.user.userId,
      userName: socket.user.email,
      roomId: data.roomId,
    };

    if (typingUsers.has(data.roomId)) {
      typingUsers.get(data.roomId)!.delete(typingUser);
    }

    // Broadcast typing stop
    socket.to(data.roomId).emit(SOCKET_EVENTS.TYPING_STOP, typingUser);
  });

  // Handle message read
  socket.on(SOCKET_EVENTS.MESSAGE_READ, (data: { messageId: string; roomId: string }) => {
    if (!socket.user || !data.messageId || !data.roomId) return;

    // Broadcast read status
    socket.to(data.roomId).emit(SOCKET_EVENTS.MESSAGE_READ, {
      messageId: data.messageId,
      userId: socket.user.userId,
      timestamp: new Date(),
    });

    console.log(`Message ${data.messageId} marked as read by ${socket.user.email}`);
  });

  // Get room history
  socket.on('get_room_history', (roomId: string) => {
    if (!socket.user || !roomId) return;

    const messages = chatMessages.get(roomId) || [];
    socket.emit('room_history', { roomId, messages });
  });
};
