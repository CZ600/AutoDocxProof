export type ProofreadStage = 'splitting' | 'theme' | 'proofreading' | 'reviewing' | 'completed'

export type ProofreadMode = 'full' | 'section' | 'sentence'

export interface ProofreadProgressPayload {
  stage: ProofreadStage
  mode: ProofreadMode
  total?: number
  completed?: number
  percent?: number
  message?: string
}
