import { api } from '../api'
import type { ChatSession, Message, Rating } from '../types/chat'

export const listSessions = () => api.get<ChatSession[]>('/chat/sessions')
export const getSession = (sessionId: string) => api.get<ChatSession>(`/chat/sessions/${sessionId}`)
export const createSession = () => api.post<ChatSession>('/chat/sessions')
export const deleteSession = (sessionId: string) => api.delete(`/chat/sessions/${sessionId}`)
export const sendMessage = (sessionId: string, question: string) =>
  api.post<Message>(`/chat/sessions/${sessionId}/messages`, { question })
export const submitFeedback = (sessionId: string, messageId: string, rating: Rating, categories: string[], comment: string) =>
  api.post('/feedback', { session_id: sessionId, message_id: messageId, rating, categories, comment })