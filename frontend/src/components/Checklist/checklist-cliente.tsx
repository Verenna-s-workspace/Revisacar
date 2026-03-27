import './check-list.css'
import './checkCli.css'
import { Input } from '../inputs/input';
import { useState } from "react";
//import Button from '../../components/button/button';


export default function ClienteCheck(){
const [nome, setNome] = useState("");
const [telefone, setTelefone] = useState("");
const [cpf, setCpf] = useState("");
const [email, setEmail] = useState("");
    return(
        
        <div className='Checklist'>
            
           <div className="nome-input"> <Input 
                label='Nome completo'
                name='nome'
                placeholder='Ex: Maria Farias Gomes'
                value={nome}
                onlyText
                onChangeValue={setNome}
            />
            </div>
              <div className="telefone-input"><Input 
                label='Telefone / Whatsapp'
                name='telefone'
                placeholder='(00) 0000-00000'
                value={telefone}
                onlyNumbers
                onChangeValue={setTelefone}
                error={telefone.length > 11 ?  'Número inválido' : ''}
                
            />
            </div> 
               <div className="cpf-input"><Input 
                label='CPF (opcional)'
                name='cpf'
                placeholder='000.000.000-00'
                value={cpf}
                onlyNumbers
                onChangeValue={setCpf}
                error={cpf && cpf.length !==  11 ?  'Cpf inválido' : ''}
                
            />
            </div>
            <div className="email-input"> <Input 
                label='E-mail (opcional)'
                name='email'
                placeholder='email@exemplo.com'
                value={email}
                onChangeValue={setEmail}
                error={ email && !email.includes('@')  ? 'Email inválido' : ''}
                
            />
    </div>
        </div>
    )
}