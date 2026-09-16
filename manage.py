import os
import sys
import hashlib

_openssl_md5 = getattr(hashlib, 'openssl_md5', None)
if _openssl_md5 is not None:
    def _openssl_md5_compat(data=b'', *args, **kwargs):
        try:
            return _openssl_md5(data)
        except TypeError:
            return _openssl_md5()
    hashlib.openssl_md5 = _openssl_md5_compat
_orig_md5 = getattr(hashlib, 'md5', None)
if _orig_md5 is not None:
    def _md5_compat(data=b'', *args, **kwargs):
        try:
            return _orig_md5(data, **kwargs)
        except TypeError:
            return _orig_md5(data)
    hashlib.md5 = _md5_compat

def _load_env_file_if_needed():
    if 'DJANGO_SECRET_KEY' in os.environ:
        return
    candidates = [
        '/etc/gestao-operacional/django.env',
        '/etc/gestao-operacional/django-fallback.env',
        os.path.join(os.path.dirname(__file__), '.env'),
    ]
    for env_path in candidates:
        if os.path.isfile(env_path):
            try:
                with open(env_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            k, v = line.split('=', 1)
                            k = k.strip()
                            v = v.strip().strip('\'"')
                            if k not in os.environ:
                                os.environ[k] = v
            except Exception:
                pass

def main():
    _load_env_file_if_needed()
    # Prefer local developer settings if present to avoid enabling production HTTPS redirects
    if os.path.exists(os.path.join(os.path.dirname(__file__), 'setup', 'settings_local.py')):
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'setup.settings_local')
    else:
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'setup.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()