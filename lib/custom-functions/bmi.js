/**
 * BMI (Body Mass Index) custom function.
 * Calculates BMI from weight in kg and height in cm.
 */

module.exports = {
  name: 'BMI',
  signature: 'BMI(weight_kg, height_cm)',
  detail: 'Calculates Body Mass Index from weight (kg) and height (cm). Formula: weight / (height_m²)',
  minArgs: 2,
  maxArgs: 2,
  returns: 'number',
  params: [
    { name: 'weight_kg', type: 'number' },
    { name: 'height_cm', type: 'number' }
  ],
  expansion: 'ROUND({weight_kg} / (({height_cm} / 100) * ({height_cm} / 100)), 1)'
};
