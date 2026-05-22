

import { Step1 } from "../Steps/Initial/StepIdentification";
import { Step2 } from "../Steps/Initial/StepPhoto";
import { Step3 } from "../Steps/Initial/StepClosure";

export const entradaConfig = [
  {
    id: 1,
    label: "Identificação",
    component: Step1,
  },
  {
    id: 2,
    label: "Fotos",
    component: Step2,
  },
  {
    id: 3,
    label: "Encerramento",
    component: Step3,
  },
];                                                              