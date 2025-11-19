// use anchor_lang::prelude::*;

// declare_id!("5eW63Ha7mXHUPaKBp5Scy7GfuwxoSYhfFbv6P9SkSiw4");

// #[program]
// pub mod anchor_project {
//     use super::*;

//     pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
//         msg!("Greetings from: {:?}", ctx.program_id);
//         Ok(())
//     }
// }

// #[derive(Accounts)]
// pub struct Initialize {}

use anchor_lang::prelude::*;

declare_id!("5eW63Ha7mXHUPaKBp5Scy7GfuwxoSYhfFbv6P9SkSiw4");

#[program]
pub mod counter {
    use super::*;

    /// Initialize a new counter for the user
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        let clock = Clock::get()?;
        
        counter.owner = ctx.accounts.user.key();
        counter.count = 0;
        counter.total_increments = 0;
        counter.created_at = clock.unix_timestamp;
        
        msg!("Counter initialized for user: {}", ctx.accounts.user.key());
        Ok(())
    }

    /// Increment the counter by 1
    pub fn increment(ctx: Context<Increment>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        
        counter.count = counter.count.checked_add(1)
            .ok_or(ErrorCode::Overflow)?;
        counter.total_increments = counter.total_increments.checked_add(1)
            .ok_or(ErrorCode::Overflow)?;
        
        msg!("Counter incremented to: {}", counter.count);
        Ok(())
    }

    /// Reset the counter to 0 (preserves total_increments)
    pub fn reset(ctx: Context<Reset>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        
        counter.count = 0;
        
        msg!("Counter reset to 0");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + Counter::INIT_SPACE,
        seeds = [b"counter", user.key().as_ref()],
        bump
    )]
    pub counter: Account<'info, Counter>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Increment<'info> {
    #[account(
        mut,
        seeds = [b"counter", user.key().as_ref()],
        bump,
        constraint = counter.owner == user.key() @ ErrorCode::Unauthorized
    )]
    pub counter: Account<'info, Counter>,
    
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct Reset<'info> {
    #[account(
        mut,
        seeds = [b"counter", user.key().as_ref()],
        bump,
        constraint = counter.owner == user.key() @ ErrorCode::Unauthorized
    )]
    pub counter: Account<'info, Counter>,
    
    pub user: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Counter {
    pub owner: Pubkey,           // 32 bytes
    pub count: u64,              // 8 bytes
    pub total_increments: u64,   // 8 bytes
    pub created_at: i64,         // 8 bytes
}
// Total: 32 + 8 + 8 + 8 = 56 bytes + 8 (discriminator) = 64 bytes

#[error_code]
pub enum ErrorCode {
    #[msg("You are not authorized to perform this action")]
    Unauthorized,
    #[msg("Overflow error")]
    Overflow,
}