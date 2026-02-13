import random

# ─────────────────────────────────────────────────────────────────────────────
# MED GUARD "AI" ADVISOR (Rule-Based Simulation)
# ─────────────────────────────────────────────────────────────────────────────
# This module simulates the output of the "MED GUARD AI" System Prompt.
# It takes structured data and generates a compliant, formatted JSON response.
# ─────────────────────────────────────────────────────────────────────────────

def get_ai_advice(context):
    """
    Simulates the AI Model's reasoning steps to produce a structured response.
    
    Args:
        context (dict): Strict input format defined by User.
                        {
                            "user_mode": "adult" | "senior",
                            "current_risk_level": "green" | "yellow" | "red",
                            "risk_types": ["ADR", "Interaction"],
                            "medications": [...],
                            "adherence_summary": {...},
                            "symptom_summary": [...]
                        }
    
    Returns:
        dict: Strict output JSON format.
    """
    # 1. CONTEXT UNDERSTANDING
    mode = context.get("user_mode", "adult")
    risk_level = context.get("current_risk_level", "green")
    risk_types = context.get("risk_types", [])
    adherence = context.get("adherence_summary", {})
    missed_doses = adherence.get("missed_doses_last_3_days", 0)
    
    # 2. PATTERN ANALYSIS & TONE SELECTION
    is_senior = (mode == "senior")
    
    # 3. MESSAGE GENERATION
    # We build the message dynamically based on priority: RED > YELLOW > BEHAVIOR > GREEN
    
    main_message = ""
    why_list = []
    action_list = []
    
    # --- SCENARIO A: HIGH RISK (RED) ---
    if risk_level == "red":
        if "Interaction" in risk_types:
            main_message = "I have identified a potential interaction between your medicines that requires attention."
            why_list.append("Certain combinations can increase side effects.")
            if is_senior:
                action_list.append("Please show this screen to your doctor or family member.")
            else:
                action_list.append("Consult your doctor before taking the next dose.")
        elif "AMR" in risk_types:
            main_message = "It looks like an antibiotic course was interrupted or inconsistent."
            why_list.append("Missing antibiotic doses can allow bacteria to become resistant.")
            action_list.append("Try to complete the full course exactly as prescribed.")
        else:
             main_message = "A safety flag has been detected regarding your current medication."
             why_list.append("The combination or dosage might need review.")
             action_list.append("Consult a healthcare professional.")

    # --- SCENARIO B: WARNING (YELLOW) ---
    elif risk_level == "yellow":
        if "Behavior" in risk_types: 
             # Adherence issues
             main_message = "I noticed you've missed a few doses recently."
             why_list.append(f"You missed {missed_doses} doses in the last 3 days.")
             action_list.append("Setting a daily alarm might be helpful.")
             if is_senior:
                 action_list.append("Ask a family member to help remind you.")
        else:
            main_message = "There is a mild interaction or caution to be aware of."
            why_list.append("Some medicines may cause drowsiness or stomach upset.")
            action_list.append("Monitor how you feel after taking your medicine.")

    # --- SCENARIO C: ALL CLEAR (GREEN) ---
    else:
        main_message = "Your medication routine looks safe."
        why_list.append("No immediate interactions or risks detected.")
        if missed_doses == 0:
            why_list.append("You have excellent adherence!")
    
    # 3b. LIFESTYLE CONTEXT (Diet & Occupation)
    user_profile = context.get("user_profile", {})
    occupation = user_profile.get("occupation", "Unknown")
    diet = user_profile.get("diet", "Unknown")

    if occupation in ["Desk Job", "Student"]:
        action_list.append("Since you have a sedentary job, remember to stand up every hour.")
    elif occupation == "Manual Labor":
        action_list.append("Given your active job, stay hydrated, especially with these meds.")

    if diet == "Veg" and "Metformin" in context.get("medications", []):
         action_list.append("Vegetarians on Metformin should monitor Vitamin B12 levels.")

    # 4. SENIOR ADAPTATIONS
    if is_senior:
        # Simplify language further
        main_message = main_message.replace("interaction", "mix").replace("adherence", "routine")
        senior_support = {
            "enabled": True,
            "message": "Remember, we are here to support your health journey safely."
        }
    else:
        senior_support = {"enabled": False, "message": ""}

    # 5. FINAL JSON CONSTRUCTION
    return {
        "assistant_message": main_message,
        "why_this_happened": why_list,
        "what_to_do_now": action_list,
        "confidence_level": "high",  # We are confident in our DB rules
        "senior_support": senior_support,
        "one_line_dashboard_summary": f"Status: {risk_level.upper()} - {main_message.split('.')[0]}.",
        "disclaimer": "This information is for safety awareness and does not replace medical advice."
    }
