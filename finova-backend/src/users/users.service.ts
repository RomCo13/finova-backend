import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt'; 
import { SignUpUserDto } from './dto/sign-up-user.dto';
import { SignInUserDto } from './dto/sign-in-user.dto';
import { User } from './schemas/user.schema';
import * as bcrypt from 'bcryptjs';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly jwtService: JwtService, 
  ) {}

  async signUpUser(userData: SignUpUserDto): Promise<{ token: string; user: User }> {
    const newUser = new this.userModel(userData);
    const savedUser = await newUser.save();
    const token = this.jwtService.sign({ sub: savedUser._id }); 
    return { token, user: savedUser };
  }

  async signIn(userData: SignInUserDto): Promise<{ token: string; user: User }> {
    const { email, password } = userData;
    const existingUser = await this.userModel.findOne({ email }).exec();
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(password, existingUser.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({ sub: existingUser._id }); 
    return { token, user: existingUser };
  }
  
  async updateUserByEmail(email: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.userModel.findOneAndUpdate(
      { email },
      updateUserDto,
      { new: true }
    );
  
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }
  
    return user;
  }

  async reAuthByToken (id: string) {
    const user = await this.userModel.findById(id).select('-password'); // exclude password
    return user;
  }
}