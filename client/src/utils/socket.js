import { io } from 'socket.io-client'
import { API_URL } from './config'
 
// ONE shared connection to the server for the whole app.
export const socket = io(API_URL)
 
let token = null
 
// after (re)connecting, tell the server which private room we belong to.
// We send the login token (the server checks it), not the user id, so nobody can join someone else's room.
socket.on('connect', () => {
  if (token) socket.emit('join', token)
})
 
export function joinRoom(loginToken) {
  token = loginToken
  if (token && socket.connected) socket.emit('join', token)
}
 
export function leaveRoom() {
  if (token) socket.emit('leave')
  token = null
}
 