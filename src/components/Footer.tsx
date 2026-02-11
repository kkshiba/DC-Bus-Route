import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-gray-100 border-t border-gray-200">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Links */}
          <div className="flex items-center gap-6 text-sm">
            <Link
              href="#"
              className="text-gray-600 hover:text-primary-600 transition-colors"
            >
              About
            </Link>
            <Link
              href="#"
              className="text-gray-600 hover:text-primary-600 transition-colors"
            >
              Contact
            </Link>
          </div>

          {/* Credits */}
          <p className="text-sm text-gray-500 text-center md:text-right">
            By: <span className="font-medium">Antonio De Jesus</span> &{" "}
            <span className="font-medium">Kieffer Devera</span>
          </p>
        </div>

        {/* Copyright */}
        <div className="mt-4 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} DC Bus Route. Davao City Bus Route Guide.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
