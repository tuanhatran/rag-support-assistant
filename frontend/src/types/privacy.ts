export interface Policy {
  version: string
  title: string
  retention: { conversations: number; feedback: number; audit: number }
  sections: { heading: string; text: string }[]
}
