// WARNING: The following imports are just a stub, the actual build system is being worked on.
import { SoundBox } from "./soundbox.mjs";
import { LiDesktop, MusicPlayer } from "./desktop.mjs";
import { LoggerContext, AssetManager, ContentContext, Viewport, Thread } from "./commons.mjs";
import { app } from "./shared.mjs";
import { kernel } from "./kernel.mjs";


/**
 * Filesystem abstraction for lstv.space kernel/Linux.JS 2.0.
 * 
 * This is a Linux-like filesystem abstraction that aims to replicate the behavior of a typical Linux filesystem.
 * It is a part of a larger project Linux.JS which aims to bring a lightweight Linux-like VM-free environment to the web.
 */


const DEFAULT_FS_DATA = [
    ["/etc", {}],
    ["/etc/os-release", { contents: `NAME="LinuxJS"\nVERSION="2.0"\nID="linuxjs"\nVARIANT="lsw+lide-web"\nPRETTY_NAME="LinuxJS 2.0 (lstv.space, GNU/Linux)\nSUPPORT_END=2027-09-8"\nHOME_URL=https://lstv.space\nDEFAULT_HOSTNAME=linuxjs\nANSI_COLOR="0;38;2;60;110;180"\nLOGO=linuxjs-logo-icon`, isFile: true }],
    ["/etc/config.conf", { contents: "# Configuration file", isFile: true }],
    ["/home/user", {}],
    
    ["/usr", {}],
    ["/usr/bin", {}],
    ["/usr/sbin", {}],
    ["/usr/lib", {}],
    ["/usr/lib/os-release", { isSymlink: true, contents: "/etc/os-release" }],
    ["/usr/lib64", {}],
    ["/bin",   { isSymlink: true, contents: "/usr/bin" }],
    ["/sbin",  { isSymlink: true, contents: "/usr/sbin" }],
    ["/lib",   { isSymlink: true, contents: "/usr/lib" }],
    ["/lib64", { isSymlink: true, contents: "/usr/lib64" }],


    ["/var", {}],
    ["/var/log", {}],
    ["/var/tmp", {}],

    ["/tmp", {}],
    ["/dev", {}],
    ["/proc", {}],
    ["/sys", {}],
    ["/mnt", {}],
    ["/media", {}],
    ["/opt", {}],
    ["/boot", {}],
    ["/root", {}],

    ["/home/user/Documents", {}],
    ["/home/user/Downloads", {}],
    ["/home/user/Pictures", {}],
    ["/home/user/Music", {}],
    ["/home/user/Videos", {}],
    ["/home/user/Desktop", {}],
    ["/home/user/.config", {}],
    ["/home/user/.local", {}],
    ["/home/user/.cache", {}],
    ["/home/user/.bashrc", { contents: "# Bash configuration file", isFile: true }],
    ["/home/user/.profile", { contents: "# User profile configuration file", isFile: true }],
    ["/home/user/.bash_history", { contents: "", isFile: true }],

    ["/root", {}],
    ["/root/.bashrc", { contents: "# Root Bash configuration file", isFile: true }],
    ["/root/.profile", { contents: "# Root user profile configuration file", isFile: true }],
    ["/root/.bash_history", { contents: "", isFile: true }],
];

/**
 * Root Filesystem base class.
 * This doesn't implement any actual storage, but provides the interface and common functionality for different types of filesystems.
 * It provides mounting, unmounting, higher-level operations for managing files and directories, error handling, and serves as a foundation for implementing filesystems.
 */
class RootFs {
    static ENCODING = {
        "binary": 0,
        "utf8": 1,
    }

    static O_RDONLY = 0x0000; // open for reading only
    static O_WRONLY = 0x0001; // open for writing only
    static O_RDWR   = 0x0002; // open for reading and writing
    static O_ACCMODE = 0x0003; // mask for above modes

    static O_CREAT  = 0x0200; // create if non-existent
    static O_EXCL   = 0x0800; // error if already exists
    static O_TRUNC  = 0x0400; // truncate to zero length
    static O_APPEND = 0x0008; // append on each write

    static __errCache;

    static errno = {
        EPERM: 0x01, // Operation not permitted
        ENOENT: 0x02, // No such file or directory
        ESRCH: 0x03, // No such process
        EINTR: 0x04, // Interrupted system call
        EIO: 0x05, // Input/output error
        ENXIO: 0x06, // No such device or address
        E2BIG: 0x07, // Argument list too long
        ENOEXEC: 0x08, // Exec format error
        EBADF: 0x09, // Bad file descriptor
        ECHILD: 0x0a, // No child processes
        EAGAIN: 0x0b, // Resource temporarily unavailable
        EWOULDBLOCK: 0x0b, // (Same value as EAGAIN) Resource temporarily unavailable
        ENOMEM: 0x0c, // Cannot allocate memory
        EACCES: 0x0d, // Permission denied
        EFAULT: 0x0e, // Bad address
        ENOTBLK: 0x0f, // Block device required
        EBUSY: 0x10, // Device or resource busy
        EEXIST: 0x11, // File exists
        EXDEV: 0x12, // Invalid cross-device link
        ENODEV: 0x13, // No such device
        ENOTDIR: 0x14, // Not a directory
        EISDIR: 0x15, // Is a directory
        EINVAL: 0x16, // Invalid argument
        ENFILE: 0x17, // Too many open files in system
        EMFILE: 0x18, // Too many open files
        ENOTTY: 0x19, // Inappropriate ioctl for device
        ETXTBSY: 0x1a, // Text file busy
        EFBIG: 0x1b, // File too large
        ENOSPC: 0x1c, // No space left on device
        ESPIPE: 0x1d, // Illegal seek
        EROFS: 0x1e, // Read-only file system
        EMLINK: 0x1f, // Too many links
        EPIPE: 0x20, // Broken pipe
        EDOM: 0x21, // Numerical argument out of domain
        ERANGE: 0x22, // Numerical result out of range
        EDEADLK: 0x23, // Resource deadlock avoided
        EDEADLOCK: 0x23, // (Same value as EDEADLK) Resource deadlock avoided
        ENAMETOOLONG: 0x24, // File name too long
        ENOLCK: 0x25, // No locks available
        ENOSYS: 0x26, // Function not implemented
        ENOTEMPTY: 0x27, // Directory not empty
        ELOOP: 0x28, // Too many levels of symbolic links

        ENOMSG: 0x2a, // No message of desired type
        EIDRM: 0x2b, // Identifier removed
        ECHRNG: 0x2c, // Channel number out of range
        EL2NSYNC: 0x2d, // Level 2 not synchronized
        EL3HLT: 0x2e, // Level 3 halted
        EL3RST: 0x2f, // Level 3 reset
        ELNRNG: 0x30, // Link number out of range
        EUNATCH: 0x31, // Protocol driver not attached
        ENOCSI: 0x32, // No CSI structure available
        EL2HLT: 0x33, // Level 2 halted
        EBADE: 0x34, // Invalid exchange
        EBADR: 0x35, // Invalid request descriptor
        EXFULL: 0x36, // Exchange full
        ENOANO: 0x37, // No anode
        EBADRQC: 0x38, // Invalid request code
        EBADSLT: 0x39, // Invalid slot

        EBFONT: 0x3b, // Bad font file format
        ENOSTR: 0x3c, // Device not a stream
        ENODATA: 0x3d, // No data available
        ETIME: 0x3e, // Timer expired
        ENOSR: 0x3f, // Out of streams resources
        ENONET: 0x40, // Machine is not on the network
        ENOPKG: 0x41, // Package not installed
        EREMOTE: 0x42, // Object is remote
        ENOLINK: 0x43, // Link has been severed
        EADV: 0x44, // Advertise error
        ESRMNT: 0x45, // Srmount error
        ECOMM: 0x46, // Communication error on send
        EPROTO: 0x47, // Protocol error
        EMULTIHOP: 0x48, // Multihop attempted
        EDOTDOT: 0x49, // RFS specific error
        EBADMSG: 0x4a, // Bad message
        EOVERFLOW: 0x4b, // Value too large for defined data type
        ENOTUNIQ: 0x4c, // Name not unique on network
        EBADFD: 0x4d, // File descriptor in bad state
        EREMCHG: 0x4e, // Remote address changed
        ELIBACC: 0x4f, // Can not access a needed shared library
        ELIBBAD: 0x50, // Accessing a corrupted shared library
        ELIBSCN: 0x51, // .lib section in a.out corrupted
        ELIBMAX: 0x52, // Attempting to link in too many shared libraries
        ELIBEXEC: 0x53, // Cannot exec a shared library directly
        EILSEQ: 0x54, // Invalid or incomplete multibyte or wide character
        ERESTART: 0x55, // Interrupted system call should be restarted
        ESTRPIPE: 0x56, // Streams pipe error
        EUSERS: 0x57, // Too many users
        ENOTSOCK: 0x58, // Socket operation on non-socket
        EDESTADDRREQ: 0x59, // Destination address required
        EMSGSIZE: 0x5a, // Message too long
        EPROTOTYPE: 0x5b, // Protocol wrong type for socket
        ENOPROTOOPT: 0x5c, // Protocol not available
        EPROTONOSUPPORT: 0x5d, // Protocol not supported
        ESOCKTNOSUPPORT: 0x5e, // Socket type not supported
        EOPNOTSUPP: 0x5f, // Operation not supported
        ENOTSUP: 0x5f, // (Same value as EOPNOTSUPP) Operation not supported
        EPFNOSUPPORT: 0x60, // Protocol family not supported
        EAFNOSUPPORT: 0x61, // Address family not supported by protocol
        EADDRINUSE: 0x62, // Address already in use
        EADDRNOTAVAIL: 0x63, // Cannot assign requested address
        ENETDOWN: 0x64, // Network is down
        ENETUNREACH: 0x65, // Network is unreachable
        ENETRESET: 0x66, // Network dropped connection on reset
        ECONNABORTED: 0x67, // Software caused connection abort
        ECONNRESET: 0x68, // Connection reset by peer
        ENOBUFS: 0x69, // No buffer space available
        EISCONN: 0x6a, // Transport endpoint is already connected
        ENOTCONN: 0x6b, // Transport endpoint is not connected
        ESHUTDOWN: 0x6c, // Cannot send after transport endpoint shutdown
        ETOOMANYREFS: 0x6d, // Too many references: cannot splice
        ETIMEDOUT: 0x6e, // Connection timed out
        ECONNREFUSED: 0x6f, // Connection refused
        EHOSTDOWN: 0x70, // Host is down
        EHOSTUNREACH: 0x71, // No route to host
        EALREADY: 0x72, // Operation already in progress
        EINPROGRESS: 0x73, // Operation now in progress
        ESTALE: 0x74, // Stale file handle
        EUCLEAN: 0x75, // Structure needs cleaning
        ENOTNAM: 0x76, // Not a XENIX named type file
        ENAVAIL: 0x77, // No XENIX semaphores available
        EISNAM: 0x78, // Is a named type file
        EREMOTEIO: 0x79, // Remote I/O error
        EDQUOT: 0x7a, // Disk quota exceeded
        ENOMEDIUM: 0x7b, // No medium found
        EMEDIUMTYPE: 0x7c, // Wrong medium type
        ECANCELED: 0x7d, // Operation canceled
        ENOKEY: 0x7e, // Required key not available
        EKEYEXPIRED: 0x7f, // Key has expired
        EKEYREVOKED: 0x80, // Key has been revoked
        EKEYREJECTED: 0x81, // Key was rejected by service
        EOWNERDEAD: 0x82, // Owner died
        ENOTRECOVERABLE: 0x83, // State not recoverable
        ERFKILL: 0x84, // Operation not possible due to RF-kill
        EHWPOISON: 0x85, // Memory page has hardware error
    };

    static errCode(code) {
        if(!this.__errCache) {
            this.__errCache = new Map(Object.entries(this.errno).map(v => v.reverse()));
        }
        return this.__errCache.get(code);
    }

    static PATH_SEPARATOR = "/";

    // --- Utility methods for path manipulation ---

    /**
     * Normalize a path to a canonical form. This is useful for resolving relative paths, removing redundant slashes, and ensuring consistent path formatting.
     * @param {*} path The path to normalize.
     * @param {*} isAbsolute Whether the path is absolute (treats "example/" as an absolute path).
     * @returns {*} The normalized path.
     */
    static normalize(path, isAbsolute = null) {
        return LS.Util.normalizePath(path, isAbsolute);
    }

    static basename(path) {
        const normalized = LS.Util.normalizePath(path);
        const lastSepIndex = normalized.lastIndexOf(RootFs.PATH_SEPARATOR);
        if (lastSepIndex === -1) {
            return normalized;
        }
        return normalized.substring(lastSepIndex + 1);
    }

    static ensureTrailingSeparator(path, isAbsolute = null) {
        const normalized = LS.Util.normalizePath(path, isAbsolute);
        if (!normalized.endsWith(RootFs.PATH_SEPARATOR)) {
            return normalized + RootFs.PATH_SEPARATOR;
        }
        return normalized;
    }

    /**
     * Move up one directory level in a given path. Normalizes the path.
     */
    static up(path, levels = 1) {
        const normalized = LS.Util.normalizePath(path);

        let lI = path.length;

        for (let i = 0; i < levels; i++) {
            lI = normalized.lastIndexOf(RootFs.PATH_SEPARATOR, lI - 1);
            if(lI === -1) return RootFs.PATH_SEPARATOR;
        }

        return normalized.substring(0, lI);
    }

    /**
     * Join multiple path segments into a single normalized path.
     * @param  {...string} parts Path segments to join.
     * @returns {string} The joined and normalized path.
     */
    static join(...parts) {
        return LS.Util.normalizePath(parts.join(RootFs.PATH_SEPARATOR));
    }

    // Mounts is an array of [mountPoint, fs] pairs.
    #mounts = [];

    constructor(data) {
        this.mount(RootFs.PATH_SEPARATOR, new TmpFs(DEFAULT_FS_DATA));

        if(data) {
            for(const [mountPoint, fs] of data) {
                this.mount(mountPoint, fs);
            }
        }
    }

    /**
     * Mount a filesystem at a given mount point.
     * @param {string} mountPoint The mount point where the filesystem will be mounted.
     * @param {*} fs The filesystem to mount.
     */
    async mount(mountPoint, fs) {
        mountPoint = RootFs.ensureTrailingSeparator(mountPoint, true);
        this.#mounts.push([mountPoint, fs]);

        // Sort mounts by length of mount point, descending
        this.#mounts.sort((a, b) => b[0].length - a[0].length);
    }

    /**
     * Unmount a filesystem from a given mount point.
     * @param {string} mountPoint The mount point to unmount.
     */
    unmount(mountPoint) {
        mountPoint = RootFs.ensureTrailingSeparator(mountPoint, true);
        this.#mounts = this.#mounts.filter(([mp, fs]) => mp !== mountPoint);

        // todo: also close all open file descriptors
    }

    /**
     * FS operations are always async since they may access the network or other devices, including real filesystem APIs.
     * Filesystem resolution steps:
     * - Normalize path
     * - Resolve filesystem so we know how and where we can access data
     * - Resolve directory
     * - Open path & follow symlinks and check permissions
     * - Obtain handle
     * 
     * @returns {*} fd
     */
    async open(dir, flags, absolutePath = true) {
        dir = RootFs.normalize(dir, absolutePath);

        // We assume that the mounts are sorted by length of mount point, descending, so the first match is the most specific one.
        let usingFs = null;
        const dirWithSep = RootFs.ensureTrailingSeparator(dir, true);
        for(const [mp, fs] of this.#mounts) {
            if(dirWithSep.startsWith(mp)) {
                usingFs = fs;
                break;
            }
        }

        const fd = await usingFs.open(dir, flags);
        if(!fd || typeof fd === "number") throw new Error(RootFs.errCode(fd) + " when opening path: " + dir);
        return fd;
    }

    /**
     * Read from a file descriptor. If the file descriptor is invalid, an error will be thrown.
     * @param {*} fd File descriptor to read from
     * @param {*} first Offset to read from
     * @param {*} nbytes Number of bytes to read
     * @param {*} encoding ENUM RootFs.ENCODING or binary/utf8
     * @param {*} close Whether to close the file descriptor after reading
     * @returns {*} Data read
     */
    async read(fd, first = 0, nbytes = -1, encoding = RootFs.ENCODING.utf8, close = true) {
        if(!fd || !fd._fs) throw new Error(RootFs.errno.EBADF);
        const data = await fd._fs.read(fd, first, nbytes, typeof encoding === "string"? RootFs.ENCODING[encoding]: encoding);
        if(close) fd._fs.close(fd);
        return data;
    }

    /**
     * Write to a file descriptor. If the file descriptor is invalid, an error will be thrown.
     * @param {*} fd File descriptor to write to
     * @param {*} newData Data to write
     * @param {*} first Offset to write at
     * @param {*} nbytes Number of bytes to write
     * @param {*} close Whether to close the file descriptor after writing
     * @returns {*} Number of bytes written
     */
    async write(fd, newData, first = 0, nbytes = -1, close = true) {
        if(!fd || !fd._fs) throw new Error(RootFs.errno.EBADF);
        const nbytesWritten = await fd._fs.write(fd, newData, first, nbytes);
        if(close) fd._fs.close(fd);
        return nbytesWritten;
    }

    /**
     * A higher-level method that simply resolves & reads a file content at a path.
     * Note: file access can involve network/other operations, depending on the type of the fs mounted at a given path, so don't rely on this being guaranteed to resolve in a specified time.
     * @param {*} dir Path to the file to read
     * @param {*} encoding ENUM RootFs.ENCODING or binary/utf8
     * @param {*} options More read options
     * @returns {string|Uint8Array|ArrayBuffer} File content
     */
    async readFile(dir, encoding, options = {}) {
        return await this.read(await this.open(dir), options.start ?? 0, options.nbytes ?? -1, encoding, options.close ?? true);
    }

    /**
     * A higher-level that writes data to a file at a given path. If the file doesn't exist, it will be created. If it exists, it will be truncated.
     * @param {*} dir Path to the file to write
     * @param {*} newData Data to write
     * @param {*} options More write options
     * @returns {*} Number of bytes written
     */
    async writeFile(dir, newData, options = {}) {
        const fd = await this.open(dir, RootFs.O_WRONLY | RootFs.O_CREAT | RootFs.O_TRUNC);
        return await this.write(fd, newData, options.start ?? 0, options.nbytes ?? -1, options.close ?? true);
    }

    async close(fd) {
        if(!fd || !fd._fs) throw new Error(RootFs.errno.EBADF);
        return await fd._fs.close(fd);
    }

    async exists(dir) {
        try {
            const fd = await this.open(dir, RootFs.O_RDONLY);
            await this.close(fd);
            return true;
        } catch(e) {
            if(e.message.startsWith(RootFs.errCode(RootFs.errno.ENOENT))) {
                return false;
            }
            throw e;
        }
    }

    async stat(dir) {
        const fd = await this.open(dir, RootFs.O_RDONLY);
        const data = fd._fs.stat(fd);
        await this.close(fd);
        return data;
    }

    async unlink(dir, options = {}) {
        const fd = await this.open(dir, RootFs.O_WRONLY);
        const result = await fd._fs.unlink(fd);
        await this.close(fd);
        return result;
    }

    async mkdir(dir, mode = 0o777) {
        const fd = await this.open(dir, RootFs.O_WRONLY | RootFs.O_CREAT);
        const result = await fd._fs.mkdir(fd, mode);
        await this.close(fd);
        return result;
    }

    /**
     * Creates a new empty rootfs state.
     * @returns {RootFs}
     */
    static initRootFs(){
        return new RootFs();
    }

    // todo
    destroy() {
        for(const [mp, fs] of this.#mounts) {
            if(fs.destroy) fs.destroy();
        }
        this.#mounts = [];
    }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Temporary in-memory-only filesystem for testing and development.
 * This is a simple implementation that uses a Map to store file data in memory.
 */
class TmpFs {
    fs = new Map;

    constructor(data) {
        if(data) this.fs = new Map(data);
    }

    /**
     * Takes normalized directory/path, returns file descriptor or error code.
     *
     * @param {*} ndir Path to open.
     * @param {*} flags Open flags, see open(2).
     * @param {*} mode Permissions used when O_CREAT creates a file.
     * @returns {*} File descriptor or errno.
     *
     * Error code constants:
     * https://www.chromium.org/chromium-os/developer-library/reference/linux-constants/errnos/
     */
    open(ndir, flags, mode = 0o666) {
        let data = this.fs.get(ndir);

        const accessMode = flags & RootFs.O_ACCMODE;
        const canRead = accessMode === RootFs.O_RDONLY ||
                        accessMode === RootFs.O_RDWR;
        const canWrite = accessMode === RootFs.O_WRONLY ||
                        accessMode === RootFs.O_RDWR;

        if (!data) {
            if (!(flags & RootFs.O_CREAT)) {
                return RootFs.errno.ENOENT;
            }

            const now = Date.now();

            data = {
                isFile: true,
                contents: new Uint8Array(0),
                mode: mode,
                uid: 0,
                gid: 0,
                atime: now,
                mtime: now,
                ctime: now
            };

            this.fs.set(ndir, data);
        } else {
            /*
             * O_CREAT | O_EXCL must fail if the path already exists.
             */
            if ((flags & RootFs.O_CREAT) && (flags & RootFs.O_EXCL)) {
                return RootFs.errno.EEXIST;
            }
        }

        /*
         * Directories can be opened, but only for reading/searching.
         * Opening a directory for writing is an error.
         */
        if (!data.isFile && canWrite) {
            return RootFs.errno.EISDIR;
        }

        /*
         * O_TRUNC only applies to regular files opened for writing.
         */
        if ((flags & RootFs.O_TRUNC) && data.isFile && canWrite) {
            data.contents = new Uint8Array(0);

            const now = Date.now();
            data.mtime = now;
            data.ctime = now;
        }

        return {
            _fs: this,
            data,
            flags,
            offset: (flags & RootFs.O_APPEND) && data.isFile
                ? data.contents.length
                : 0,
            closed: false,
            readable: canRead,
            writable: canWrite
        };
    }


    /**
     * Destroy a file descriptor/handle.
     *
     * @param {*} fd File descriptor to be closed.
     * @returns {*} 0 on success or errno.
     */
    close(fd) {
        if (!fd || fd.closed || !fd._fs) {
            return RootFs.errno.EBADF;
        }

        fd._fs = null;
        fd.data = null;
        fd.closed = true;

        return 0;
    }


    /**
     * Validate a file descriptor.
     *
     * kind:
     *   0 = regular file
     *   1 = directory
     *
     * @param {*} fd File descriptor.
     * @param {*} kind Expected object type.
     */
    checkFd(fd, kind) {
        if (!fd || !fd._fs || !fd.data || fd.closed) {
            throw new Error(RootFs.errno.EBADF);
        }

        if (kind === 1 && fd.data.isFile) {
            throw new Error(RootFs.errno.ENOTDIR);
        }

        if (kind === 0 && !fd.data.isFile) {
            throw new Error(RootFs.errno.EISDIR);
        }
    }


    /**
     * Read from a file.
     *
     * `first` is the byte/character offset to read from.
     * `nbytes === -1` means read until EOF.
     *
     * @param {*} fd File descriptor.
     * @param {*} first Offset.
     * @param {*} nbytes Number of bytes/characters.
     * @param {*} encoding Output encoding.
     * @returns {*} Data.
     */
    read(fd, first, nbytes, encoding) {
        this.checkFd(fd, 0);

        if (!fd.readable) {
            throw new Error(RootFs.errno.EBADF);
        }

        const data = fd.data;

        if (first < 0) {
            throw new Error(RootFs.errno.EINVAL);
        }

        if (first > data.contents.length) {
            first = data.contents.length;
        }

        const end = nbytes === -1
            ? data.contents.length
            : Math.min(first + Math.max(0, nbytes), data.contents.length);

        /*
         * A successful read is an access to the file.
         */
        data.atime = Date.now();

        const result = data.contents.slice(first, end);

        /*
         * If the descriptor has an offset, advance it.
         */
        fd.offset = end;

        return this._toEncoding(result, encoding);
    }


    /**
     * Write to a file.
     *
     * `first` is the offset to write at.
     * `nbytes === -1` means write all of newData starting at `first`.
     *
     * O_APPEND causes the write to happen at EOF regardless of `first`.
     *
     * @param {*} fd File descriptor.
     * @param {*} newData Data to write.
     * @param {*} first Offset.
     * @param {*} nbytes Number of bytes/characters.
     * @returns {*} Number of bytes/characters written.
     */
    write(fd, newData, first, nbytes) {
        this.checkFd(fd, 0);

        if (!fd.writable) {
            throw new Error(RootFs.errno.EBADF);
        }

        const data = fd.data;

        /*
         * Convert ArrayBuffer into Uint8Array.
         */
        if (data.contents instanceof ArrayBuffer) {
            data.contents = new Uint8Array(data.contents);
        }

        /*
         * O_APPEND ignores the supplied offset.
         */
        if (fd.flags & RootFs.O_APPEND) {
            first = data.contents.length;
        }

        /*
         * Use the descriptor offset if the caller didn't explicitly supply one.
         */
        if (first === undefined || first === null) {
            first = fd.offset ?? 0;
        }

        if (first < 0) {
            throw new Error(RootFs.errno.EINVAL);
        }

        /*
         * Normalize input according to the file's representation.
         */
        if (data.contents instanceof Uint8Array) {
            if (typeof newData === "string") {
                newData = encoder.encode(newData);
            }

            if (!(newData instanceof Uint8Array)) {
                if (newData instanceof ArrayBuffer) {
                    newData = new Uint8Array(newData);
                } else {
                    throw new Error(RootFs.errno.EINVAL);
                }
            }

            const available = newData.length - first;

            if (nbytes === -1) {
                nbytes = available;
            }

            if (nbytes < 0 || first > newData.length && nbytes !== 0) {
                throw new Error(RootFs.errno.EINVAL);
            }

            if (nbytes === 0) {
                return 0;
            }

            /*
             * The source range is [first, first + nbytes).
             */
            const sourceEnd = Math.min(first + nbytes, newData.length);
            const actualBytes = sourceEnd - first;

            if (actualBytes <= 0) {
                return 0;
            }

            const requiredLength = first + actualBytes;

            if (requiredLength > data.contents.length) {
                const newContents = new Uint8Array(requiredLength);

                newContents.set(data.contents, 0);
                newContents.set(newData.slice(first, sourceEnd), first);

                data.contents = newContents;
            } else {
                data.contents.set(
                    newData.slice(first, sourceEnd),
                    first
                );
            }

            fd.offset = first + actualBytes;

            const now = Date.now();
            data.mtime = now;
            data.ctime = now;

            return actualBytes;
        }


        if (typeof data.contents === "string") {
            if (typeof newData !== "string") {
                newData = decoder.decode(newData);
            }

            if (first > newData.length && nbytes !== 0) {
                throw new Error(RootFs.errno.EINVAL);
            }

            if (nbytes === -1) {
                nbytes = newData.length - first;
            }

            if (nbytes < 0) {
                throw new Error(RootFs.errno.EINVAL);
            }

            if (nbytes === 0) {
                return 0;
            }

            const sourceEnd = Math.min(first + nbytes, newData.length);
            const actualBytes = sourceEnd - first;

            if (actualBytes <= 0) {
                return 0;
            }

            /*
             * String files are treated as character-addressed.
             * Writing beyond EOF creates the intervening space.
             */
            if (first > data.contents.length) {
                data.contents =
                    data.contents +
                    "\0".repeat(first - data.contents.length);
            }

            data.contents =
                data.contents.substring(0, first) +
                newData.substring(first, sourceEnd) +
                data.contents.substring(first + actualBytes);

            fd.offset = first + actualBytes;

            const now = Date.now();
            data.mtime = now;
            data.ctime = now;

            return actualBytes;
        }

        throw new Error(RootFs.errno.EINVAL);
    }


    /**
     * Return file metadata.
     *
     * @param {*} fd File descriptor.
     * @returns {*} stat-like object.
     */
    stat(fd) {
        this.checkFd(fd);

        const data = fd.data;

        const now = Date.now();

        data.mtime ??= now;
        data.ctime ??= now;
        data.atime ??= now;

        return {
            size: data.contents instanceof Uint8Array
                ? data.contents.byteLength
                : data.contents.length,

            mtime: data.mtime,
            ctime: data.ctime,
            atime: data.atime,

            mode: data.mode ?? 0o644,
            uid: data.uid ?? 0,
            gid: data.gid ?? 0,

            isFile: data.isFile,
            isDirectory: !data.isFile,

            isSymbolicLink: data.isSymlink ?? false,
            isBlockDevice: data.isBlockDevice ?? false,
            isCharacterDevice: data.isCharacterDevice ?? false,
            isFIFO: data.isFIFO ?? false,
            isSocket: data.isSocket ?? false
        };
    }

    unlink(fd) {
        this.checkFd(fd);

        const data = fd.data;

        if (!data.isFile) {
            return RootFs.errno.EISDIR;
        }

        this.fs.delete(fd.path);

        return 0;
    }

    mkdir(ndir, recursive, mode = 0o755, uid = 0, gid = 0) {
        if (this.fs.has(ndir)) {
            return RootFs.errno.EEXIST;
        }

        if (!recursive) {
            const parent = LS.Util.dirname(ndir);
            if (!this.fs.has(parent)) {
                return RootFs.errno.ENOENT;
            }
        }

        // TODO: must create all intermediate directories and check for existing files in the path

        const now = Date.now();

        this.fs.set(ndir, {
            isFile: false,
            mode: mode,
            uid: uid,
            gid: gid,
            atime: now,
            mtime: now,
            ctime: now
        });

        return 0;
    }

    _toEncoding(data, encoding) {
        if(encoding === RootFs.ENCODING.utf8) return typeof data === "string"? data: decoder.decode(data);
        if(typeof data === "string") {
            return encoder.encode(data);
        }
        return data;
    }

    destroy() {
        this.fs.clear();
    }
}

/**
 * An in-memory zip-based filesystem.
 * Stores data in a zip format in memory, supports compression, can be easily loaded/saved and patched.
 */
class MemFs {}

/**
 * Very simple localStorage-based filesystem for small amounts of data.
 */
class LocalStorageFs extends TmpFs {}

/**
 * Remote cloud filesystem.
 */
class RemoteFs {}

/**
 * IndexedDB-based filesystem for local browser storage.
 */
class IndexedDbFs {}

/**
 * Node.js-based filesystem for direct host-machine storage.
 */
class NodeFs {}

/**
 * WASM filesystem (to be implemented)
 */
class WasmFs {}

/**
 * RQvFS filesystem (to be implemented)
 */
class RqvFs {}