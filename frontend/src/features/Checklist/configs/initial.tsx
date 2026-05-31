import { Step1 } from "../Steps/Initial/StepIdentification";
import { Step2 } from "../Steps/Initial/StepPhoto";
import { Step3 } from "../Steps/Initial/StepClosure";

export const entradaConfig = [
  {
    id: 1,
    label: "Identificação",
    component: Step1,
    icon: (
      <svg width={13} height={13} viewBox="0 0 13 13">
        <rect x="1.5" y="1.5" width="10" height="10" rx="2" />
      </svg>
    ),
  },
  {
    id: 2,
    label: "Fotos",
    component: Step2,
    icon: (
      <svg width={13} height={13} viewBox="0 0 13 13">
        <circle cx="6.5" cy="6.5" r="4" />
      </svg>
    ),
  },

  {
    id: 3,
    label: "Encerramento",
    component: Step3,
    icon: (
      <svg width={13} height={13} viewBox="0 0 13 13">
        <path d="M2 6 L5 9 L11 3" />
      </svg>
    ),
    hasSignature: true,
  },
];
