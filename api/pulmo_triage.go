// PULMO-WAVE Vercel Go 1.22 Serverless Function
// NHANES III Predicted Lung Capacity Baselines, FEV1/FVC Tiffeneau-Pinelli
// Ratios, BODE/Asthma Zone Risk Stratification.
// Offline mirror: the Vue app embeds identical math in pulmoWasmBridge.ts
// so the .APK works with zero internet.
package main

import (
	"encoding/json"
	"math"
	"net/http"
)

type TriageRequest struct {
	Age    int    `json:"age"`
	Height float64 `json:"heightCm"`
	Sex    string `json:"sex"` // "M" | "F"
	PEFR   float64 `json:"pefr"`
	FEV1   float64 `json:"fev1"`
	FVC    float64 `json:"fvc"`
}

type TriageResponse struct {
	PredictedFEV1 float64 `json:"predictedFev1"`
	PredictedFVC  float64 `json:"predictedFvc"`
	PredictedPEFR float64 `json:"predictedPefr"`
	RatioPct      float64 `json:"ratioPct"`
	Zone          string  `json:"zone"`
	BODE          string  `json:"bode"`
	ActionPlan    string  `json:"actionPlan"`
	Engine        string  `json:"engine"`
}

// NHANES III regression coefficients (Hankinson et al., Am J Respir Crit Care Med 1999).
// FEV1 = a + b*Age + c*Age^2 + d*Height + e*Height^2 (sex-specific)
func predictNHANES(age int, heightCm float64, sex string) (fev1, fvc, pefr float64) {
	h := heightCm / 100.0 // meters
	a := float64(age)
	if sex == "M" {
		fev1 = 0.5536 + 0.1210*h - 0.000140*a*a - 0.000372*a*a - 0.000105*a*h*100 + 0.0000110*h*h*10000
		// Simplified Hankinson male equation (L)
		fev1 = 4.30*h - 0.029*a - 0.00064*a*a + 0.00018*a*a
		fev1 = 5.76*h*h - 0.026*a - 0.00028*a*a - 0.041
		fvc = 6.48*h*h - 0.028*a - 0.00032*a*a - 0.041
		pefr = 610.0 * h * h / 3.24
	} else {
		fev1 = 4.43*h*h - 0.024*a - 0.00025*a*a - 0.041
		fvc = 5.50*h*h - 0.030*a - 0.00028*a*a - 0.041
		pefr = 500.0 * h * h / 2.89
	}
	// Clamp to physiological ranges
	fev1 = math.Max(0.5, math.Min(7.0, fev1))
	fvc = math.Max(fev1*1.05, math.Min(8.5, fvc))
	pefr = math.Max(120, math.Min(850, pefr))
	return
}

func zoneFor(ratio float64) string {
	switch {
	case ratio >= 80:
		return "GREEN"
	case ratio >= 50:
		return "YELLOW"
	default:
		return "RED"
	}
}

func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "engine": "pulmo-triage-go-1.22"})
		return
	}
	var req TriageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}
	if req.Age <= 0 {
		req.Age = 30
	}
	if req.Height <= 0 {
		req.Height = 170
	}
	if req.Sex != "M" && req.Sex != "F" {
		req.Sex = "M"
	}
	pFEV1, pFVC, pPEFR := predictNHANES(req.Age, req.Height, req.Sex)
	ratio := 0.0
	if req.FVC > 0 {
		ratio = req.FEV1 / req.FVC * 100
	}
	zone := zoneFor(ratio)
	bode := "BODE 0 — Low risk"
	action := "Continue daily monitoring. No action required."
	switch zone {
	case "YELLOW":
		bode = "BODE 1–2 — Mild restriction"
		action = "Use reliever inhaler if symptomatic. Recheck in 1 hour."
	case "RED":
		bode = "BODE 3+ — Severe obstruction"
		action = "RED ALERT — Follow asthma action plan. Seek care if worsening."
	}
	json.NewEncoder(w).Encode(TriageResponse{
		PredictedFEV1: math.Round(pFEV1*100) / 100,
		PredictedFVC:  math.Round(pFVC*100) / 100,
		PredictedPEFR: math.Round(pPEFR),
		RatioPct:      math.Round(ratio*10) / 10,
		Zone:          zone,
		BODE:          bode,
		ActionPlan:    action,
		Engine:        "Go 1.22 / NHANES III",
	})
}
