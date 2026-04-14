const pick = (obj: Record<string, any>, keys: string[]): Record<string, any> => {
  const finalObj: Record<string, any> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      finalObj[key] = obj[key];
    }
  }
  return finalObj;
};

export default pick;
