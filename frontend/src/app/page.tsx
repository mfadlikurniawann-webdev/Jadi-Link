import Link from 'next/link';
import { Brand } from '@/components/app-shell';
import { Icon } from '@/components/icons';

export default function HomePage() {
  return (
    <div className="landing">
      <header className="landing-header">
        <Brand />
        <div className="flex items-center gap-2">
          <Link href="/login" className="button button-quiet button-small">
            Masuk
          </Link>
          <Link href="/register" className="button button-primary button-small">
            Daftar
          </Link>
        </div>
      </header>
      <main id="main-content" className="landing-hero animate-enter">
        <span className="landing-tag">
          <span className="dot dot-green" />
          URL shortener + analitik
        </span>
        <h1>
          Link singkat.
          <br />
          <span>Klik terukur.</span>
        </h1>
        <p>Persingkat URL dan pantau setiap kliknya.</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/register" className="button button-primary">
            Mulai gratis
            <Icon name="arrow" width={18} />
          </Link>
          <Link href="/login" className="button button-secondary">
            Sudah punya akun
          </Link>
        </div>
        <div className="landing-demo">
          <span className="demo-icon">
            <Icon name="link" width={24} />
          </span>
          <div className="demo-url">
            <p className="truncate">
              jadilink/<strong>cerita-baru</strong>
            </p>
          </div>
          <div className="demo-clicks">
            <strong>1.284</strong>
            <span>klik</span>
          </div>
        </div>
      </main>
    </div>
  );
}
