class ZodError extends Error {
  constructor(issues) {
    super('Validation failed');
    this.issues = issues;
    this.name = 'ZodError';
  }
}

class BaseSchema {
  safeParse(value) {
    try {
      const data = this.parse(value);
      return { success: true, data };
    } catch (error) {
      if (error instanceof ZodError) {
        return { success: false, error };
      }
      return { success: false, error: new ZodError([{ message: error.message }]) };
    }
  }
}

class NumberSchema extends BaseSchema {
  constructor() {
    super();
    this.checks = [];
  }
  int() {
    this.checks.push({
      message: 'Expected integer',
      fn: (value) => Number.isInteger(value),
    });
    return this;
  }
  positive() {
    this.checks.push({
      message: 'Expected positive number',
      fn: (value) => value > 0,
    });
    return this;
  }
  nonnegative() {
    this.checks.push({
      message: 'Expected non-negative number',
      fn: (value) => value >= 0,
    });
    return this;
  }
  min(minValue) {
    this.checks.push({
      message: `Expected value >= ${minValue}`,
      fn: (value) => value >= minValue,
    });
    return this;
  }
  max(maxValue) {
    this.checks.push({
      message: `Expected value <= ${maxValue}`,
      fn: (value) => value <= maxValue,
    });
    return this;
  }
  parse(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      throw new ZodError([{ message: 'Expected numeric value' }]);
    }
    const issues = [];
    for (const check of this.checks) {
      if (!check.fn(num)) {
        issues.push({ message: check.message });
      }
    }
    if (issues.length > 0) {
      throw new ZodError(issues);
    }
    return num;
  }
}

class EnumSchema extends BaseSchema {
  constructor(values) {
    super();
    this.values = values;
  }
  parse(value) {
    if (this.values.includes(value)) {
      return value;
    }
    throw new ZodError([{ message: `Expected one of ${this.values.join(', ')}` }]);
  }
}

class OptionalSchema extends BaseSchema {
  constructor(inner) {
    super();
    this.inner = inner;
  }
  parse(value) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return this.inner.parse(value);
  }
}

class ObjectSchema extends BaseSchema {
  constructor(shape) {
    super();
    this.shape = shape;
  }
  parse(value) {
    if (typeof value !== 'object' || value === null) {
      throw new ZodError([{ message: 'Expected object' }]);
    }
    const data = {};
    const issues = [];
    for (const key of Object.keys(this.shape)) {
      try {
        data[key] = this.shape[key].parse(value[key]);
      } catch (error) {
        if (error instanceof ZodError) {
          issues.push(...error.issues.map((issue) => ({ ...issue, path: [key] })));
        } else {
          issues.push({ message: error.message, path: [key] });
        }
      }
    }
    if (issues.length > 0) {
      throw new ZodError(issues);
    }
    return data;
  }
}

function optional(schema) {
  return new OptionalSchema(schema);
}

export const z = {
  number: () => new NumberSchema(),
  enum: (values) => new EnumSchema(values),
  object: (shape) => new ObjectSchema(shape),
  optional,
  ZodError,
};
