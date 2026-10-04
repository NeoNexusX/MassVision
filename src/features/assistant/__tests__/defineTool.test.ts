import { describe, expect, it } from 'vitest'
import { defineTool, validateArgs, toToolSchema } from '../tools/defineTool'

describe('defineTool + validateArgs', () => {
  const echoTool = defineTool({
    name: 'echo',
    description: 'Echo back the input',
    parameters: {
      message: { type: 'string', required: true, description: 'The message to echo' },
    },
    output: { render: (args) => `echo: ${args.message}` },
    async execute(args) {
      return args.message
    },
  })

  it('validates required fields', () => {
    const result = validateArgs(echoTool, {})
    expect(result.valid).toBe(false)
    expect(!result.valid && result.errors[0]!.field).toBe('message')
  })

  it('validates correct args', () => {
    const result = validateArgs(echoTool, { message: 'hello' })
    expect(result.valid).toBe(true)
    expect(result.valid && result.args.message).toBe('hello')
  })

  it('validates enum constraints', () => {
    const tool = defineTool({
      name: 'pick',
      description: 'Pick a color',
      parameters: {
        color: { type: 'string', required: true, enum: ['red', 'blue'] },
      },
      output: { render: (a) => a.color },
      async execute() { return null },
    })

    const ok = validateArgs(tool, { color: 'red' })
    expect(ok.valid).toBe(true)

    const bad = validateArgs(tool, { color: 'green' })
    expect(bad.valid).toBe(false)
  })

  it('validates numeric types', () => {
    const tool = defineTool({
      name: 'add',
      description: 'Add two numbers',
      parameters: {
        a: { type: 'number', required: true },
        b: { type: 'integer', required: false },
      },
      output: { render: () => '' },
      async execute() { return null },
    })

    const ok = validateArgs(tool, { a: 1.5, b: 3.2 })
    expect(ok.valid).toBe(true)
    expect(ok.valid && ok.args.a).toBe(1.5)
    expect(ok.valid && ok.args.b).toBe(3) // integer 截断

    const bad = validateArgs(tool, { a: 'not-a-number' })
    expect(bad.valid).toBe(false)
  })

  it('validates boolean types', () => {
    const tool = defineTool({
      name: 'flag',
      description: 'Toggle',
      parameters: { verbose: { type: 'boolean', required: true } },
      output: { render: () => '' },
      async execute() { return null },
    })

    expect(validateArgs(tool, { verbose: true }).valid).toBe(true)
    expect(validateArgs(tool, { verbose: false }).valid).toBe(true)
    expect(validateArgs(tool, { verbose: 'yes' }).valid).toBe(false)
  })

  it('converts to ToolSchema for LLM function calling', () => {
    const schema = toToolSchema(echoTool)
    expect(schema.name).toBe('echo')
    expect(schema.description).toBe('Echo back the input')
    expect(schema.parameters.type).toBe('object')
    expect(schema.parameters.required).toContain('message')
    expect(schema.parameters.properties.message?.type).toBe('string')
  })

  it('rejects null/undefined input', () => {
    expect(validateArgs(echoTool, null).valid).toBe(false)
    expect(validateArgs(echoTool, undefined).valid).toBe(false)
  })
})