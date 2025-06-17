// /src/runtime/assert.js

// UPDATED: Import both engines
import { rulesEngine, transformsEngine } from './rules.js'
import { ValidationError } from './errors.js'

/**
 * Validates and sanitizes data against a schema object at runtime.
 * Throws a detailed error upon validation failure.
 * Returns a sanitized data object upon success.
 * @param {object} data - The data object to validate.
 * @param {object} schema - The schema object for the current level of data.
 * @param {object} [allSchemas={}] - An object containing all available schemas for nesting.
 * @returns {object} The sanitized data object.
 */
export function assert(data, schema, allSchemas = {}) {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Assertion failed: provided data must be a non-null object.')
  }

  // NEW: Create a shallow copy to hold sanitized data. We will modify this copy.
  const sanitizedData = { ...data }

  for (const schemaKey in schema) {
    const isOptional = schemaKey.endsWith('?')
    const propertyName = isOptional ? schemaKey.slice(0, -1) : schemaKey
    const rules = schema[schemaKey]

    if (!sanitizedData.hasOwnProperty(propertyName)) {
      if (isOptional) {
        continue
      } else {
        throw new Error(`Assertion failed: required property '${propertyName}' is missing.`)
      }
    }

    // --- NEW: Block to apply transformations before validation ---
    if (rules.transform && Array.isArray(rules.transform)) {
      let currentValue = sanitizedData[propertyName]
      for (const transformName of rules.transform) {
        const transformFn = transformsEngine[transformName]
        if (transformFn) {
          currentValue = transformFn(currentValue)
        }
      }
      sanitizedData[propertyName] = currentValue
    }
    // -----------------------------------------------------------

    // UPDATED: Get the value from the sanitized copy for validation.
    const value = sanitizedData[propertyName]

    // (The rest of the nesting/validation logic remains the same)
    if (allSchemas && allSchemas[rules.type]) {
      try {
        // Pass the sanitized nested object for validation.
        const sanitizedNested = assert(value, allSchemas[rules.type], allSchemas)
        // Place the returned sanitized nested object back into our copy.
        sanitizedData[propertyName] = sanitizedNested
      } catch (error) {
        // UPDATED: Handle nested ValidationErrors gracefully
        if (error instanceof ValidationError) {
          throw new ValidationError({
            property: `${propertyName}.${error.property}`, // Prepend path
            message: error.message,
            value: error.value,
            rule: error.rule,
          })
        } else {
          // Fallback for other unexpected errors
          throw new Error(`Validation failed for '${propertyName}': ${error.message}`)
        }
      }
    } else {
      for (const ruleName in rules) {
        if (ruleName === 'transform') continue // Don't treat 'transform' as a validation rule

        const ruleArgument = rules[ruleName]
        const validator = rulesEngine[ruleName]

        if (!validator) {
          throw new ValidationError({
            property: propertyName,
            rule: 'unknown',
            message: `Unknown validation rule: '${ruleName}'.`,
          })        }
        if (!validator(value, ruleArgument)) {
          throw new ValidationError({
            property: propertyName,
            rule: ruleName,
            message: `Validation failed for rule '${ruleName}'.`,
            value: value,
          })
        }
      }
    }
  }

  // UPDATED: Return the sanitized data object on success.
  return sanitizedData
}
