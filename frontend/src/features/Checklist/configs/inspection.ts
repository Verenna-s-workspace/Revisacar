
import { Step1 } from "../Steps/inspection/StepServices";
import { Step2 } from "../Steps/inspection/StepDiagnostic";

export const DiagnosticoConfig = [
  {
    id: 1,
    label: "Serviços",
    component: Step1,
  },
  {
    id: 2,
    label: "Diagnóstico",
    component: Step2,
  },
 
];                                                              