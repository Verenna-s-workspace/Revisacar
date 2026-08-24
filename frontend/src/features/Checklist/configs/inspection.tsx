import { Step1 } from "../Steps/inspection/StepServices";
import { Step2 } from "../Steps/inspection/StepDiagnostic";
import { Step3 } from "../Steps/inspection/StepServicesParts";
import { Step4 } from "../Steps/inspection/StepCopyPaste";
import { Icons } from "../Utils/icons";

export const DiagnosticoConfig = [
  { id: 1, label: "Serviços", component: Step1,  icon: Icons.orders, },
  { id: 2, label: "Diagnóstico", component: Step2, icon: Icons.info },
  { id: 3, label: "Peças", component: Step3, icon: Icons.wrench },
  { id: 4, label: "Texto", component: Step4, icon: Icons.edit },
];
