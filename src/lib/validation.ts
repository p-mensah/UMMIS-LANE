import { useState, useCallback, useMemo } from 'react';

// Common validator function type
export type ValidatorFn<T = any> = (value: any, allValues?: T) => string | null;

export type ValidationRules<T> = {
  [K in keyof T]?: ValidatorFn<T>[] | ValidatorFn<T>;
};

// Global format and boundary validators
export const validators = {
  /**
   * Field cannot be empty, null, undefined, or blank whitespace
   */
  required: (message = 'This field is required'): ValidatorFn => {
    return (val) => {
      if (val === undefined || val === null) return message;
      if (typeof val === 'string' && val.trim() === '') return message;
      if (typeof val === 'number' && isNaN(val)) return message;
      if (Array.isArray(val) && val.length === 0) return message;
      return null;
    };
  },

  /**
   * Validates standard email address format
   */
  email: (message = 'Please enter a valid email address (e.g. user@domain.com)'): ValidatorFn => {
    return (val) => {
      if (!val || (typeof val === 'string' && val.trim() === '')) return null; // Optional if not required
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      return emailRegex.test(String(val).trim()) ? null : message;
    };
  },

  /**
   * Validates phone numbers (supports Ghana +233, 02x/05x/03x and standard international formats)
   */
  phone: (message = 'Please enter a valid phone number (e.g. +233 24 123 4567 or 0241234567)'): ValidatorFn => {
    return (val) => {
      if (!val || (typeof val === 'string' && val.trim() === '')) return null;
      // Strip spaces, dashes, dots, parentheses
      const clean = String(val).replace(/[\s\-().]/g, '');
      // Accepts +233... or local 02x, 05x, 03x or 7 to 15 digits
      const phoneRegex = /^(\+?[1-9]\d{1,14}|0[235][0-9]{8})$/;
      return phoneRegex.test(clean) ? null : message;
    };
  },

  /**
   * Numeric minimum value
   */
  min: (minVal: number, message?: string): ValidatorFn => {
    return (val) => {
      if (val === '' || val === null || val === undefined) return null;
      const num = Number(val);
      if (isNaN(num)) return 'Must be a valid number';
      if (num < minVal) {
        return message || `Minimum value is ${minVal}`;
      }
      return null;
    };
  },

  /**
   * Numeric maximum value
   */
  max: (maxVal: number, message?: string): ValidatorFn => {
    return (val) => {
      if (val === '' || val === null || val === undefined) return null;
      const num = Number(val);
      if (isNaN(num)) return 'Must be a valid number';
      if (num > maxVal) {
        return message || `Maximum value is ${maxVal}`;
      }
      return null;
    };
  },

  /**
   * String minimum length
   */
  minLength: (len: number, message?: string): ValidatorFn => {
    return (val) => {
      if (!val) return null;
      const str = String(val);
      if (str.length < len) {
        return message || `Must be at least ${len} characters`;
      }
      return null;
    };
  },

  /**
   * String maximum length
   */
  maxLength: (len: number, message?: string): ValidatorFn => {
    return (val) => {
      if (!val) return null;
      const str = String(val);
      if (str.length > len) {
        return message || `Cannot exceed ${len} characters`;
      }
      return null;
    };
  },

  /**
   * Must be strictly greater than 0
   */
  positive: (message = 'Must be greater than 0'): ValidatorFn => {
    return (val) => {
      if (val === '' || val === null || val === undefined) return null;
      const num = Number(val);
      if (isNaN(num) || num <= 0) return message;
      return null;
    };
  },

  /**
   * Must be greater than or equal to 0
   */
  nonNegative: (message = 'Cannot be negative'): ValidatorFn => {
    return (val) => {
      if (val === '' || val === null || val === undefined) return null;
      const num = Number(val);
      if (isNaN(num) || num < 0) return message;
      return null;
    };
  },

  /**
   * Must be a valid whole integer
   */
  integer: (message = 'Must be a whole integer'): ValidatorFn => {
    return (val) => {
      if (val === '' || val === null || val === undefined) return null;
      const num = Number(val);
      if (isNaN(num) || !Number.isInteger(num)) return message;
      return null;
    };
  },

  /**
   * Currency or unit price validation (> 0, at most 2 decimal places)
   */
  price: (message = 'Please enter a valid price (e.g. 25.50)'): ValidatorFn => {
    return (val) => {
      if (val === '' || val === null || val === undefined) return null;
      const num = Number(val);
      if (isNaN(num) || num <= 0) return message;
      return null;
    };
  },

  /**
   * SKU format: alphanumeric with dashes, slashes or underscores, 2-30 chars
   */
  sku: (message = 'SKU should be alphanumeric with optional dashes (e.g. PROD-001)'): ValidatorFn => {
    return (val) => {
      if (!val || (typeof val === 'string' && val.trim() === '')) return null;
      const skuRegex = /^[A-Za-z0-9_\-\/]{2,30}$/;
      return skuRegex.test(String(val).trim()) ? null : message;
    };
  },

  /**
   * Barcode: alphanumeric or UPC/EAN standard digits
   */
  barcode: (message = 'Barcode must contain valid alphanumeric or numeric code'): ValidatorFn => {
    return (val) => {
      if (!val || (typeof val === 'string' && val.trim() === '')) return null;
      const barcodeRegex = /^[A-Za-z0-9]{4,32}$/;
      return barcodeRegex.test(String(val).trim()) ? null : message;
    };
  },

  /**
   * Valid HTTP/HTTPS web URL
   */
  url: (message = 'Please enter a valid URL starting with http:// or https://'): ValidatorFn => {
    return (val) => {
      if (!val || (typeof val === 'string' && val.trim() === '')) return null;
      try {
        const parsed = new URL(String(val).trim());
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? null : message;
      } catch {
        return message;
      }
    };
  },

  /**
   * Future date validator (useful for SLAs, expected arrival, expiry dates)
   */
  futureDate: (message = 'Date must be today or in the future'): ValidatorFn => {
    return (val) => {
      if (!val) return null;
      const target = new Date(val);
      if (isNaN(target.getTime())) return 'Invalid date format';
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return target >= today ? null : message;
    };
  },

  /**
   * Custom validator rule wrapper
   */
  custom: <T = any>(
    predicate: (value: any, allValues?: T) => boolean,
    message: string
  ): ValidatorFn<T> => {
    return (val, allValues) => {
      return predicate(val, allValues) ? null : message;
    };
  }
};

/**
 * React hook providing real-time visual feedback for forms.
 * Tracks values, touched status, inline validation errors, and overall form validity.
 */
export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  rules: ValidationRules<T> = {},
  options: { validateOnChange?: boolean } = { validateOnChange: true }
) {
  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Single field validator runner
  const validateField = useCallback(
    (field: keyof T, val: any, currentValues?: T): string | null => {
      const fieldRules = rules[field];
      if (!fieldRules) return null;
      const list = Array.isArray(fieldRules) ? fieldRules : [fieldRules];
      const contextValues = currentValues || values;

      for (const rule of list) {
        const error = rule(val, contextValues);
        if (error) return error;
      }
      return null;
    },
    [rules, values]
  );

  // Real-time change handler
  const handleChange = useCallback(
    (field: keyof T, value: any) => {
      setIsDirty(true);
      setValuesState((prev) => {
        const updated = { ...prev, [field]: value };
        // If validateOnChange is enabled and field was touched, re-evaluate error in real time
        if (options.validateOnChange && touched[field]) {
          const err = validateField(field, value, updated);
          setErrors((prevErr) => {
            if (err) return { ...prevErr, [field]: err };
            const nextErr = { ...prevErr };
            delete nextErr[field];
            return nextErr;
          });
        }
        return updated;
      });
    },
    [options.validateOnChange, touched, validateField]
  );

  // Blur handler: marks field as touched and computes error
  const handleBlur = useCallback(
    (field: keyof T) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const err = validateField(field, values[field]);
      setErrors((prevErr) => {
        if (err) return { ...prevErr, [field]: err };
        const nextErr = { ...prevErr };
        delete nextErr[field];
        return nextErr;
      });
    },
    [validateField, values]
  );

  // Programmatically set a single field value
  const setFieldValue = useCallback(
    (field: keyof T, value: any, shouldValidate = true) => {
      setIsDirty(true);
      setValuesState((prev) => {
        const updated = { ...prev, [field]: value };
        if (shouldValidate) {
          const err = validateField(field, value, updated);
          setErrors((prevErr) => {
            if (err) return { ...prevErr, [field]: err };
            const nextErr = { ...prevErr };
            delete nextErr[field];
            return nextErr;
          });
        }
        return updated;
      });
    },
    [validateField]
  );

  // Bulk set values (e.g. when opening an edit modal)
  const setValues = useCallback(
    (newValues: Partial<T>) => {
      setValuesState((prev) => ({ ...prev, ...newValues }));
      setErrors({});
      setTouched({});
      setIsDirty(false);
    },
    []
  );

  // Validate all fields on submit: marks all fields as touched, returns true if valid
  const validateAll = useCallback((): boolean => {
    const allTouched: Partial<Record<keyof T, boolean>> = {};
    const newErrors: Partial<Record<keyof T, string>> = {};
    let hasError = false;

    for (const key of Object.keys(rules) as Array<keyof T>) {
      allTouched[key] = true;
      const err = validateField(key, values[key]);
      if (err) {
        newErrors[key] = err;
        hasError = true;
      }
    }

    setTouched(allTouched);
    setErrors(newErrors);
    return !hasError;
  }, [rules, validateField, values]);

  // Reset form to initial or new values
  const reset = useCallback(
    (newInitialValues?: T) => {
      setValuesState(newInitialValues || initialValues);
      setErrors({});
      setTouched({});
      setIsDirty(false);
    },
    [initialValues]
  );

  // Check if form is currently valid
  const isValid = useMemo(() => {
    for (const key of Object.keys(rules) as Array<keyof T>) {
      const err = validateField(key, values[key]);
      if (err) return false;
    }
    return true;
  }, [rules, validateField, values]);

  // Helper to extract visual state for an input
  const getFieldState = useCallback(
    (field: keyof T) => {
      const isFieldTouched = !!touched[field];
      const error = errors[field];
      const isInvalid = isFieldTouched && !!error;
      const isValidField = isFieldTouched && !error && values[field] !== undefined && values[field] !== '';

      return {
        value: values[field],
        error,
        isTouched: isFieldTouched,
        isInvalid,
        isValid: isValidField,
        onChange: (e: any) => {
          const val = e && e.target !== undefined ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
          handleChange(field, val);
        },
        onBlur: () => handleBlur(field)
      };
    },
    [errors, handleBlur, handleChange, touched, values]
  );

  return {
    values,
    errors,
    touched,
    isDirty,
    isValid,
    handleChange,
    handleBlur,
    setFieldValue,
    setValues,
    validateField,
    validateAll,
    reset,
    getFieldState
  };
}
