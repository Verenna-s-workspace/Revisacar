import './panel.css'
import Button from '../../components/button/button';


export default function Panellist() {
    return(
        <div className="list-panel">
                <div className="panel-items">
                    <Button texto='1.Cliente'/>
                    <Button texto='2.Veiculo'/>
                    <Button texto='3.Diagnostico'/>
                    <Button texto='4.Foto'/>
                    <Button texto='5.Peças'/>
                    <Button texto='6.Resumo'/>
                </div>
        </div>
    )

}

