import jwt, { SignOptions } from "jsonwebtoken";
import { IUser } from "../types";

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
}

export class JWTUtil {
  private static readonly ACCESS_TOKEN_SECRET =
    process.env.JWT_SECRET || "your-secret-key";
  private static readonly REFRESH_TOKEN_SECRET =
    process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
  private static readonly ACCESS_TOKEN_EXPIRY = "15m" as const;
  private static readonly REFRESH_TOKEN_EXPIRY = "7d" as const;

  /**
   * Generate access token
   */
  static generateAccessToken(user: IUser): string {
    const payload: JWTPayload = {
      id: user._id,
      email: user.email,
      role: user.role,
    };

    const options: SignOptions = {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: "blackbox-commerce",
      audience: "blackbox-commerce-users",
    };

    return jwt.sign(payload, this.ACCESS_TOKEN_SECRET, options);
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(user: IUser): string {
    const payload: JWTPayload = {
      id: user._id,
      email: user.email,
      role: user.role,
    };

    const options: SignOptions = {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      issuer: "blackbox-commerce",
      audience: "blackbox-commerce-users",
    };

    return jwt.sign(payload, this.REFRESH_TOKEN_SECRET, options);
  }

  /**
   * Generate both access and refresh tokens
   */
  static generateTokenPair(user: IUser): {
    accessToken: string;
    refreshToken: string;
  } {
    return {
      accessToken: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user),
    };
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.ACCESS_TOKEN_SECRET, {
        issuer: "blackbox-commerce",
        audience: "blackbox-commerce-users",
      }) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("Access token expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Invalid access token");
      }
      throw new Error("Invalid access token");
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.REFRESH_TOKEN_SECRET, {
        issuer: "blackbox-commerce",
        audience: "blackbox-commerce-users",
      }) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("Refresh token expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Invalid refresh token");
      }
      throw new Error("Token verification failed");
    }
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) return null;

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return null;
    }

    return parts[1];
  }

  /**
   * Get token payload without verification (for debugging)
   */
  static decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) return true;

      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch {
      return true;
    }
  }

  /**
   * Get token expiry date
   */
  static getTokenExpiry(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) return null;

      return new Date(decoded.exp * 1000);
    } catch {
      return null;
    }
  }
}

export default JWTUtil;
