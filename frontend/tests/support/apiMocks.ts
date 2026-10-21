import { vi } from 'vitest'
import * as adminApi from '../../src/api/admin'
import * as authApi from '../../src/api/auth'
import * as chatApi from '../../src/api/chat'
import * as documentApi from '../../src/api/documents'
import * as ingestionApi from '../../src/api/ingestion'
import * as privacyApi from '../../src/api/privacy'
import { viewFixtures } from './fixtures'

export function mockApis() {
  vi.spyOn(authApi, 'getCurrentUser').mockResolvedValue(viewFixtures.standardUser)
  vi.spyOn(authApi, 'getPlanOptions').mockResolvedValue([
    { id: 'basic', description: 'Basic access', model: null, connection: null },
    { id: 'standard', description: 'Standard access', model: 'assistant', connection: 'main' },
    { id: 'premium', description: 'Premium access', model: 'advanced', connection: 'plus' },
  ])
  vi.spyOn(authApi, 'signIn').mockResolvedValue(viewFixtures.standardUser)
  vi.spyOn(authApi, 'register').mockResolvedValue(viewFixtures.standardUser)
  vi.spyOn(authApi, 'signOut').mockResolvedValue(undefined)

  vi.spyOn(chatApi, 'listSessions').mockResolvedValue([])
  vi.spyOn(chatApi, 'getSession').mockResolvedValue(viewFixtures.session)
  vi.spyOn(chatApi, 'createSession').mockResolvedValue({
    ...viewFixtures.session,
    id: 'created-1',
    title: 'New conversation',
    messages: [],
  })
  vi.spyOn(chatApi, 'deleteSession').mockResolvedValue(undefined)
  vi.spyOn(chatApi, 'sendMessage').mockResolvedValue(viewFixtures.sentMessage)
  vi.spyOn(chatApi, 'submitFeedback').mockResolvedValue(undefined)

  vi.spyOn(documentApi, 'listDocuments').mockResolvedValue([])
  vi.spyOn(documentApi, 'getDocument').mockResolvedValue(viewFixtures.document)

  vi.spyOn(privacyApi, 'getPolicy').mockResolvedValue(viewFixtures.policy)
  vi.spyOn(privacyApi, 'acceptPolicy').mockResolvedValue(undefined)
  vi.spyOn(privacyApi, 'exportUserData').mockResolvedValue({ user: 'ava', conversations: [] })
  vi.spyOn(privacyApi, 'eraseUserData').mockResolvedValue({ conversations_deleted: 2, feedback_deleted: 1 })
  vi.spyOn(privacyApi, 'deleteUserAccount').mockResolvedValue(undefined)

  vi.spyOn(adminApi, 'listConnections').mockResolvedValue([viewFixtures.connection])
  vi.spyOn(adminApi, 'listUsers').mockResolvedValue([viewFixtures.account])
  vi.spyOn(adminApi, 'listFeedback').mockResolvedValue([viewFixtures.feedback])
  vi.spyOn(adminApi, 'getFeedbackStats').mockResolvedValue({
    total: 1,
    helpful: 1,
    not_helpful: 0,
    satisfaction_percent: 100,
  })
  vi.spyOn(adminApi, 'listAudit').mockResolvedValue([])
  vi.spyOn(adminApi, 'saveConnection').mockResolvedValue(viewFixtures.connection)
  vi.spyOn(adminApi, 'testConnection').mockResolvedValue({ ok: true, message: 'Connection test succeeded.' })
  vi.spyOn(adminApi, 'deleteConnection').mockResolvedValue(undefined)
  vi.spyOn(adminApi, 'updateUser').mockResolvedValue(viewFixtures.account)

  vi.spyOn(ingestionApi, 'getIngestionOptions').mockResolvedValue(viewFixtures.ingestionOptions)
  vi.spyOn(ingestionApi, 'listPipelines').mockResolvedValue([])
  vi.spyOn(ingestionApi, 'createPipeline').mockResolvedValue({ id: viewFixtures.pipeline.id, status: 'queued' })
  vi.spyOn(ingestionApi, 'getPipeline').mockResolvedValue(viewFixtures.pipeline)
  vi.spyOn(ingestionApi, 'getPipelineChunks').mockResolvedValue([viewFixtures.chunk])
}
