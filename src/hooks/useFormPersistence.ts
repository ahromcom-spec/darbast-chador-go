import { useState, useEffect } from 'react';

interface FormData {
  [key: string]: string;
}

export function useFormPersistence(formKey: string, initialData: FormData = {}) {
  const [formData, setFormData] = useState<FormData>(initialData);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(`form-${formKey}`);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setFormData({ ...initialData, ...parsedData });
      }
    } catch (error) {
      console.error('Error loading form data from localStorage:', error);
    } finally {
      setIsLoaded(true);
    }
  }, [formKey]);

  // Save data to localStorage whenever formData changes
  useEffect(() => {
    if (isLoaded && Object.keys(formData).length > 0) {
      try {
        // Only save non-empty values
        const dataToSave = Object.entries(formData).reduce((acc, [key, value]) => {
          if (value && value.trim() !== '') {
            acc[key] = value;
          }
          return acc;
        }, {} as FormData);
        
        if (Object.keys(dataToSave).length > 0) {
          localStorage.setItem(`form-${formKey}`, JSON.stringify(dataToSave));
        }
      } catch (error) {
        console.error('Error saving form data to localStorage:', error);
      }
    }
  }, [formData, formKey, isLoaded]);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const clearForm = () => {
    setFormData(initialData);
    try {
      localStorage.removeItem(`form-${formKey}`);
    } catch (error) {
      console.error('Error clearing form data from localStorage:', error);
    }
  };

  const getField = (field: string): string => {
    return formData[field] || '';
  };

  return {
    formData,
    isLoaded,
    updateField,
    clearForm,
    getField,
  };
}