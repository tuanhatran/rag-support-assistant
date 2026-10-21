import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Markdown } from '../../src/components/Markdown'

describe('Markdown', () => {
  it('renders Markdown with GFM formatting', () => {
    render(<Markdown>{'~~old~~ **new**'}</Markdown>)
    expect(screen.getByText('old').tagName).toBe('DEL')
    expect(screen.getByText('new').tagName).toBe('STRONG')
  })
})
