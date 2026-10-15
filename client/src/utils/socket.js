import { io } from 'socket.io-client'
import { API_URL } from './config'
 
// Save as: client/src/utils/socket.js
// ONE shared connection to the server for the whole app.
export const socket = io(API_URL)
 
let userId = null
 
// after (re)connecting, tell the server which private room we belong to
socket.on('connect', () => {
  if (userId) socket.emit('join', userId)
})
 
export function joinRoom(id) {
  userId = id
  if (socket.connected) socket.emit('join', id)
}
 
export function leaveRoom() {
  if (userId) socket.emit('leave', userId)
  userId = null
}
 