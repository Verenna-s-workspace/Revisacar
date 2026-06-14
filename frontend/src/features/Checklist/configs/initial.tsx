import { Step1 } from "../Steps/Initial/StepIdentification";
import { Step2 } from "../Steps/Initial/StepPhoto";
import { Step3 } from "../Steps/Initial/StepClosure";
import { Icons } from "../Utils/icons";

export const entradaConfig = [
  {
    id: 1,
    label: "Identificação",
    component: Step1,
    icon: Icons.user,
  },
  {
    id: 2,
    label: "Fotos",
    component: Step2,
    icon: Icons.camera,
  },

  {
    id: 3,
    label: "Encerramento",
    component: Step3,
    icon: Icons.check,
    hasSignature: true,
  },
];
