"use client";

import API from "../services/api";
import toast from "react-hot-toast";

const IncidentButton = () => {

  const simulateIncident = async () => {

    try {

      await API.post("/incidents/simulate");

      toast.success("Incident simulated successfully");

    } catch(error) {

      console.log(error);

      toast.error("Something went wrong");
    }
  };

  return (
    <button
      onClick={simulateIncident}
      className="bg-red-500 text-white px-6 py-3 rounded-xl mt-8"
    >
      Simulate Production Incident
    </button>
  );
};

export default IncidentButton;