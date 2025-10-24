import { Request, Response, NextFunction } from "express";
import { User } from "../models";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../config/email";
import { AuthenticatedRequest } from "../types/express";
import * as crypto from "crypto";

// Register user
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Handle avatar upload if provided
    let avatar;
    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(
          req.file,
          "blackbox-commerce/avatars"
        );
        avatar = {
          public_id: uploadResult.public_id,
          url: uploadResult.url,
        };
      } catch (uploadError) {
        return res.status(400).json({
          success: false,
          message: "Failed to upload avatar image",
        });
      }
    }

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      avatar,
    });

    // Generate JWT token
    const token = user.generateJWT();

    // Send welcome email (don't block response)
    sendWelcomeEmail(user.name, user.email).catch(console.error);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: userResponse,
        token,
      },
    });
  } catch (error: any) {
    // Clean up uploaded avatar if user creation fails
    if (req.file && error) {
      try {
        const uploadResult = await uploadToCloudinary(
          req.file,
          "blackbox-commerce/avatars"
        );
        await deleteFromCloudinary(uploadResult.public_id);
      } catch (cleanupError) {
        console.error("Error cleaning up failed avatar upload:", cleanupError);
      }
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    next(error);
  }
};

// Login user
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user with password field
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate JWT token
    const token = user.generateJWT();

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: userResponse,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Logout user
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Clear cookie
    res.clearCookie("token");

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    next(error);
  }
};

// Forgot password
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;

    // Validate email format and presence
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });

    // For security reasons, always return success even if user doesn't exist
    // This prevents email enumeration attacks
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "Password reset email sent successfully",
      });
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    try {
      // Send password reset email
      await sendPasswordResetEmail(user.email, user.name, resetUrl);

      res.status(200).json({
        success: true,
        message: "Password reset email sent successfully",
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      // Don't clear the reset token - user can still use the reset link
      // even if email notification failed
      res.status(200).json({
        success: true,
        message: "Password reset email sent successfully",
      });
    }
  } catch (error) {
    next(error);
  }
};

// Reset password
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+passwordResetToken +passwordResetExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Password reset token is invalid or has expired",
      });
    }

    // Set new password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Generate new JWT token
    const jwtToken = user.generateJWT();

    // Remove sensitive fields from response
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.passwordResetToken;
    delete userResponse.passwordResetExpires;

    res.status(200).json({
      success: true,
      message: "Password reset successful",
      data: {
        user: userResponse,
        token: jwtToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get current user profile
export const getProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // User is attached to request by auth middleware
    const user = req.user;

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update user profile
export const updateProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user._id;
    const { name, email } = req.body;

    // Check if email is already taken by another user
    if (email && email !== req.user.email) {
      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: userId },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email is already taken by another user",
        });
      }
    }

    // Handle avatar upload if provided
    let avatarUpdate = {};
    if (req.file) {
      try {
        // Delete old avatar if exists
        if (req.user.avatar?.public_id) {
          await deleteFromCloudinary(req.user.avatar.public_id);
        }

        // Upload new avatar
        const uploadResult = await uploadToCloudinary(
          req.file,
          "blackbox-commerce/avatars"
        );
        avatarUpdate = {
          avatar: {
            public_id: uploadResult.public_id,
            url: uploadResult.url,
          },
        };
      } catch (uploadError) {
        return res.status(400).json({
          success: false,
          message: "Failed to upload avatar image",
        });
      }
    }

    // Update user
    const updateData = {
      ...(name && { name }),
      ...(email && { email: email.toLowerCase() }),
      ...avatarUpdate,
    };

    const user = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user,
      },
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }
    next(error);
  }
};

// Change password
export const changePassword = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};

export default {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword,
};
