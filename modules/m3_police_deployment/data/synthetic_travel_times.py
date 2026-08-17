# Synthetic Travel Time Matrix (in minutes) for Prototype MVP
# Symmetric matrix: TRAVEL_TIMES[loc1][loc2]
TRAVEL_TIMES = {
    "WARDHA_ROAD": {
        "WARDHA_ROAD": 0, "ZERO_MILE": 5, "SITABULDI": 8, "MAHAL": 12, "LAXMI_NAGAR": 6, "MANEWADA": 15
    },
    "ZERO_MILE": {
        "WARDHA_ROAD": 5, "ZERO_MILE": 0, "SITABULDI": 3, "MAHAL": 7, "LAXMI_NAGAR": 10, "MANEWADA": 18
    },
    "SITABULDI": {
        "WARDHA_ROAD": 8, "ZERO_MILE": 3, "SITABULDI": 0, "MAHAL": 5, "LAXMI_NAGAR": 12, "MANEWADA": 20
    },
    "MAHAL": {
        "WARDHA_ROAD": 12, "ZERO_MILE": 7, "SITABULDI": 5, "MAHAL": 0, "LAXMI_NAGAR": 14, "MANEWADA": 10
    },
    "LAXMI_NAGAR": {
        "WARDHA_ROAD": 6, "ZERO_MILE": 10, "SITABULDI": 12, "MAHAL": 14, "LAXMI_NAGAR": 0, "MANEWADA": 10
    },
    "MANEWADA": {
        "WARDHA_ROAD": 15, "ZERO_MILE": 18, "SITABULDI": 20, "MAHAL": 10, "LAXMI_NAGAR": 10, "MANEWADA": 0
    }
}
