import './home.css'
import '../../index.css'
import '../../components/panel-list/panel'
import '../../components/Checklist/checklist-cliente';

import logo from "../../assets/Logorevisabranca.svg";
import Panellist from '../../components/panel-list/panel';
import ClienteCheck from '../../components/Checklist/checklist-cliente';


export default function Home() {
  return (
    <section className='home-container'>
<div className="wrapper">
  <div className="vscode">
    <div className="titlebar">
      <div className="car"><img src= {logo} alt="" /></div>
        <div className="dot dot-r"></div>
      <div className="dot dot-y"></div>
      <div className="dot dot-g"></div>
    </div>
     <div className="layout">
      <div className="sidebar">
        <div className="sidebar-header">
          <Panellist />
          </div>
       
      </div>
      <div className="panel" id="panel">
        <div className="welcome">
          <div className="panel-title"><h1>Checklist  Automotivo </h1></div>
          <div className="panel-sub"><ClienteCheck /> </div>
        </div>
      </div>
    </div>
    </div>
    </div>
    </section>
  

  )
}