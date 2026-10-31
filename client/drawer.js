/** Native modal handles focus trapping, Escape and inert background. Restore trigger on close. */
export function createDrawer(React){
 const h=React.createElement;
 return function Drawer({title,onClose,children}){
  const ref=React.useRef(null),close=React.useRef(onClose);close.current=onClose;
  React.useEffect(()=>{const trigger=document.activeElement,d=ref.current;d.showModal();return()=>{d.close();if(trigger?.isConnected)trigger.focus();};},[]);
  return h('dialog',{ref,className:'pi-drawer','aria-label':title,onCancel:e=>{e.preventDefault();close.current();}},h('header',null,h('h2',null,title),h('button',{type:'button',onClick:onClose,'aria-label':'关闭'+title},'关闭')),children);
 };
}
