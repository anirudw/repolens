import { describe, it, expect } from 'vitest';
import { JavaParser } from '../src/parser/strategies/java';
import { JavaScriptParser } from '../src/parser/strategies/javascript';

describe('Java AST Extractor - Class/Interface Extraction', () => {
  const parser = new JavaParser();

  it('should extract interface and class with implements', async () => {
    const code = `
interface Logger {}
class ConsoleLogger implements Logger {}
`;
    const result = await parser.parse('test.java', code);

    expect(result.metadata.definedInterfaces).toContain('Logger');
    expect(result.metadata.definedClasses).toContain('ConsoleLogger');
    expect(result.metadata.implementsInterfaces).toContain('Logger');
  });

  it('should extract multiple interfaces from implements', async () => {
    const code = `
interface A {}
interface B {}
class MyClass implements A, B {}
`;
    const result = await parser.parse('test.java', code);

    expect(result.metadata.definedInterfaces).toEqual(['A', 'B']);
    expect(result.metadata.definedClasses).toContain('MyClass');
    expect(result.metadata.implementsInterfaces).toContain('A');
    expect(result.metadata.implementsInterfaces).toContain('B');
  });

  it('should handle class without implements clause', async () => {
    const code = `
class SimpleClass {}
`;
    const result = await parser.parse('test.java', code);

    expect(result.metadata.definedClasses).toContain('SimpleClass');
    expect(result.metadata.implementsInterfaces).toEqual([]);
  });

  it('should extract multiple classes and interfaces', async () => {
    const code = `
interface Service {}
class UserService implements Service {}
class AuthService implements Service {}
`;
    const result = await parser.parse('test.java', code);

    expect(result.metadata.definedInterfaces).toContain('Service');
    expect(result.metadata.definedClasses).toContain('UserService');
    expect(result.metadata.definedClasses).toContain('AuthService');
    expect(result.metadata.implementsInterfaces).toHaveLength(2);
  });
});

describe('JavaScript/TypeScript AST Extractor - Class/Interface Extraction', () => {
  const parser = new JavaScriptParser();

  it('should extract class names from JavaScript', async () => {
    const code = `
class ConsoleLogger {}
class UserService {}
`;
    const result = await parser.parse('test.js', code);

    expect(result.metadata.definedClasses).toContain('ConsoleLogger');
    expect(result.metadata.definedClasses).toContain('UserService');
  });

  it('should handle class without implements clause', async () => {
    const code = `
class SimpleClass {}
`;
    const result = await parser.parse('test.js', code);

    expect(result.metadata.definedClasses).toContain('SimpleClass');
    expect(result.metadata.implementsInterfaces).toEqual([]);
  });

  it('should handle multiple classes', async () => {
    const code = `
class UserService {}
class AuthService {}
`;
    const result = await parser.parse('test.js', code);

    expect(result.metadata.definedClasses).toContain('UserService');
    expect(result.metadata.definedClasses).toContain('AuthService');
  });

  it('should handle JavaScript class with extends (not implements)', async () => {
    const code = `
class BaseClass {}
class DerivedClass extends BaseClass {}
`;
    const result = await parser.parse('test.js', code);

    expect(result.metadata.definedClasses).toContain('BaseClass');
    expect(result.metadata.definedClasses).toContain('DerivedClass');
    expect(result.metadata.implementsInterfaces).toEqual([]);
  });

  it('should extract interfaces from TypeScript files', async () => {
    const code = `
interface ILogger {}
interface IDatabase {}
`;
    const result = await parser.parse('test.ts', code);

    expect(result.metadata.definedInterfaces).toContain('ILogger');
    expect(result.metadata.definedInterfaces).toContain('IDatabase');
  });

  it('should extract class and interfaces from TypeScript with implements', async () => {
    const code = `
interface ILogger {}
class Service implements ILogger {}
`;
    const result = await parser.parse('test.ts', code);

    expect(result.metadata.definedInterfaces).toContain('ILogger');
    expect(result.metadata.definedClasses).toContain('Service');
    expect(result.metadata.implementsInterfaces).toContain('ILogger');
  });
});
