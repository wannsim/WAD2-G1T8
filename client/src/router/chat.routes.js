
import ChatView from '@/views/chat/ChatView.vue'
 
export default [
  { path: '/chats', component: ChatView },
  { path: '/chats/:id', component: ChatView }, // :id = chat to open straight away
]
 