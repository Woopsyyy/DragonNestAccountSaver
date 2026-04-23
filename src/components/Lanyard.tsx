import lanyardImage from '../assets/lanyard.png'

export default function Lanyard() {
  return (
    <div className="landing-lanyard" aria-hidden="true">
      <img src={lanyardImage} alt="" className="landing-lanyard__image" />
    </div>
  )
}
