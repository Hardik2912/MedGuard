export function useBrain() {

    async function analyzePrescription() {

        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
            medicines: [
                {
                    name: "Paracetamol",
                    dosage: "500mg twice daily",
                    safety: "Safe",
                    risk: "Low",
                    trafficLight: "green"
                },
                {
                    name: "Ibuprofen",
                    dosage: "400mg once daily",
                    safety: "Moderate",
                    risk: "Medium",
                    trafficLight: "yellow"
                }
            ],
            demo: true
        };
    }

    return {
        analyzePrescription
    };
}