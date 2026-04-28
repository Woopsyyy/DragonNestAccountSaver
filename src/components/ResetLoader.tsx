import styled from 'styled-components'

type ResetLoaderProps = {
  title: string
  detail: string
}

export default function ResetLoader({ title, detail }: ResetLoaderProps) {
  return (
    <StyledWrapper role="status" aria-live="polite">
      <div className="reset-loader__scrim">
        <div className="reset-loader__panel">
          <div className="loader" aria-hidden="true" />
          <div className="reset-loader__copy">
            <strong>{title}</strong>
            <span>{detail}</span>
          </div>
        </div>
      </div>
    </StyledWrapper>
  )
}

const StyledWrapper = styled.div`
  .reset-loader__scrim {
    position: fixed;
    inset: 0;
    z-index: 1400;
    display: grid;
    place-items: center;
    padding: 24px;
    background:
      radial-gradient(circle at top, rgba(114, 221, 255, 0.16), transparent 36%),
      rgba(5, 10, 24, 0.82);
    backdrop-filter: blur(18px);
  }

  .reset-loader__panel {
    width: min(420px, 100%);
    min-height: 260px;
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.8)),
      rgba(15, 23, 42, 0.88);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.38);
    display: grid;
    gap: 24px;
    place-items: center;
    padding: 32px 28px;
    text-align: center;
  }

  .reset-loader__copy {
    display: grid;
    gap: 10px;
  }

  .reset-loader__copy strong {
    color: #f8fafc;
    font-size: 1.35rem;
    font-weight: 700;
  }

  .reset-loader__copy span {
    color: rgba(226, 232, 240, 0.84);
    line-height: 1.6;
  }

  .loader {
    position: relative;
    width: 2.5em;
    height: 2.5em;
    transform: rotate(165deg);
  }

  .loader:before,
  .loader:after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    display: block;
    width: 0.5em;
    height: 0.5em;
    border-radius: 0.25em;
    transform: translate(-50%, -50%);
  }

  .loader:before {
    animation: before8 2s infinite;
  }

  .loader:after {
    animation: after6 2s infinite;
  }

  @keyframes before8 {
    0% {
      width: 0.5em;
      box-shadow:
        1em -0.5em rgba(225, 20, 98, 0.75),
        -1em 0.5em rgba(111, 202, 220, 0.75);
    }

    35% {
      width: 2.5em;
      box-shadow:
        0 -0.5em rgba(225, 20, 98, 0.75),
        0 0.5em rgba(111, 202, 220, 0.75);
    }

    70% {
      width: 0.5em;
      box-shadow:
        -1em -0.5em rgba(225, 20, 98, 0.75),
        1em 0.5em rgba(111, 202, 220, 0.75);
    }

    100% {
      box-shadow:
        1em -0.5em rgba(225, 20, 98, 0.75),
        -1em 0.5em rgba(111, 202, 220, 0.75);
    }
  }

  @keyframes after6 {
    0% {
      height: 0.5em;
      box-shadow:
        0.5em 1em rgba(61, 184, 143, 0.75),
        -0.5em -1em rgba(233, 169, 32, 0.75);
    }

    35% {
      height: 2.5em;
      box-shadow:
        0.5em 0 rgba(61, 184, 143, 0.75),
        -0.5em 0 rgba(233, 169, 32, 0.75);
    }

    70% {
      height: 0.5em;
      box-shadow:
        0.5em -1em rgba(61, 184, 143, 0.75),
        -0.5em 1em rgba(233, 169, 32, 0.75);
    }

    100% {
      box-shadow:
        0.5em 1em rgba(61, 184, 143, 0.75),
        -0.5em -1em rgba(233, 169, 32, 0.75);
    }
  }

  .loader {
    position: relative;
  }
`
