import Link from 'next/link';
import { Brand } from '@/components/app-shell';
import { Icon } from '@/components/icons';

export default function HomePage() {
  return (
    <div className="landing">
      <header className="landing-header">
        <Brand />
        <Link href="/login" className="button button-secondary">
          Masuk
          <Icon name="arrow" width={16} />
        </Link>
      </header>
      <main id="main-content" className="landing-hero">
        <span className="landing-tag">
          <span />
          SATU TAUTAN. BANYAK KEMUNGKINAN.
        </span>
        <h1>
          Link-nya singkat.
          <br />
          <span>Ceritanya panjang.</span>
        </h1>
        <p>
          Ubah URL panjang jadi tautan yang mudah dibagikan.
          <br className="hidden sm:block" />
          Lihat dari mana klik datang, tanpa menyimpan IP mentah.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/register" className="button button-primary">
            Mulai dari satu tautan
            <Icon name="arrow" width={18} />
          </Link>
          <Link href="/login" className="button button-secondary">
            Sudah punya akun
          </Link>
        </div>
        <div className="landing-demo">
          <div className="demo-top">
            <span className="flex gap-1.5">
              <i />
              <i />
              <i />
            </span>
            <span>LINK YANG SIAP DIBAGIKAN</span>
            <Icon name="shield" width={16} />
          </div>
          <div className="demo-url">
            <span className="demo-icon">
              <Icon name="link" width={27} />
            </span>
            <div>
              <span className="text-xs text-muted">
                Ide besar. Tautan kecil.
              </span>
              <p>
                jadilink / <strong>cerita-baru</strong>
              </p>
            </div>
            <Icon name="arrow" width={24} />
          </div>
          <div className="demo-features">
            <span>
              <Icon name="link" width={15} />
              Alias personal
            </span>
            <span>
              <Icon name="chart" width={15} />
              Analitik 30 hari
            </span>
            <span>
              <Icon name="shield" width={15} />
              Privasi lebih dulu
            </span>
          </div>
        </div>
      </main>
      <footer className="landing-footer">
        <span>Dibuat agar berbagi terasa lebih sederhana.</span>
        <span>JADI LINK / SHORTER BY DESIGN</span>
      </footer>
    </div>
  );
}
