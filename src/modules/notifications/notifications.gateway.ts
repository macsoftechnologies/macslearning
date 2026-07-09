import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // Map to store connected users: userId -> socketId
  private connectedUsers = new Map<string, string>();

  constructor(private configService: ConfigService) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const token =
        client.handshake.auth.token ||
        client.handshake.headers['authorization']?.split(' ')[1];
      if (!token) {
        client.disconnect();
        return;
      }
      const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
      const payload: any = jwt.verify(token, secret as string);

      const userId = payload.userId;
      if (userId) {
        this.connectedUsers.set(userId, client.id);
        console.log(`Client connected: ${userId} (${client.id})`);
      } else {
        client.disconnect();
      }
    } catch (err) {
      client.disconnect();
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    let disconnectedUserId = null;
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (socketId === client.id) {
        disconnectedUserId = userId;
        break;
      }
    }
    if (disconnectedUserId) {
      this.connectedUsers.delete(disconnectedUserId);
      console.log(`Client disconnected: ${disconnectedUserId} (${client.id})`);
    }
  }

  sendNotification(userId: string, notification: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.server.to(socketId).emit('new_notification', notification);
    }
  }
}
