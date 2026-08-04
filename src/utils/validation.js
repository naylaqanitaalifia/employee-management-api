const required = (field) => {
  const errors = {};

  for (const [key, value] of Object.entries(field)) {
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && !value.trim())
    ) {
      errors[key] = `${key} is required`;
    }
  }
  return errors;
};

module.exports = {
  required,
};
