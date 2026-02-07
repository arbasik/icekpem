
const price = 6000;
const weight = 7000; // 7kg in grams

// Old logic:
// 1. Calculate Unit Price
const unitPrice = price / weight; // 0.8571428571428571

console.log(`Input: ${price} RUB for ${weight}g`);
console.log(`Calculated Unit Price (float): ${unitPrice}`);

// 2. Simulate DB Save (Numeric 15,6 handles this fine, essentially storing 0.857143)
// But let's see what happens if we use the float directly for the reverse calc
const reverseTotal = unitPrice * weight;
console.log(`Reverse Calculation (Float * Weight): ${reverseTotal}`);

// 3. Simulate DB Rounding to 6 decimal places (0.857143)
const dbUnitPrice = parseFloat(unitPrice.toFixed(6));
console.log(`DB Stored Unit Price (6 decimals): ${dbUnitPrice}`);

const dbReverseTotal = dbUnitPrice * weight;
console.log(`DB Reverse Calculation (Stored * Weight): ${dbReverseTotal}`); // 6000.001
console.log(`Final Display (Rounded to 2 decimals): ${dbReverseTotal.toFixed(2)}`); // 6000.00
