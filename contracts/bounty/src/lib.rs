#![no_std]
#![allow(unexpected_cfgs)]

use core::option::Option;
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, Env, IntoVal, String,
    Symbol, Val, Vec,
};

#[derive(Clone, PartialEq)]
#[contracttype]
pub enum BountyStatus {
    Open,
    Claimed,
    Completed,
    Cancelled,
}

#[derive(Clone)]
#[contracttype]
pub struct Bounty {
    pub id: u32,
    pub poster: Address,
    pub title: String,
    pub description: String,
    pub reward_xlm: i128,
    pub status: BountyStatus,
    pub worker: Option<Address>,
    pub created_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Bounty(u32),
    BountyCount,
    TokenContract,
    Admin,
    TotalPaid,
}

#[contract]
pub struct BountyContract;

fn extend_ttl(env: &Env) {
    env.storage().instance().extend_ttl(200_000, 200_000);
}

fn extend_bounty_ttl(env: &Env, id: u32) {
    env.storage()
        .persistent()
        .extend_ttl(&DataKey::Bounty(id), 200_000, 200_000);
}

fn publish<T>(env: &Env, topic: Symbol, data: T)
where
    T: IntoVal<Env, Val>,
{
    env.events().publish((topic,), data);
}

fn get_bounty_or_panic(env: &Env, id: u32) -> Bounty {
    env.storage()
        .persistent()
        .get(&DataKey::Bounty(id))
        .unwrap_or_else(|| panic!("not found"))
}

fn get_token_contract(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::TokenContract)
        .unwrap_or_else(|| panic!("not initialized"))
}

fn get_bounty_count(env: &Env) -> u32 {
    env.storage().instance().get(&DataKey::BountyCount).unwrap_or(0)
}

#[contractimpl]
impl BountyContract {
    pub fn init(env: Env, admin: Address, token_contract: Address) {
        admin.require_auth();

        if env.storage().instance().has(&DataKey::Admin) {
            panic!("exists");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::TokenContract, &token_contract);
        env.storage().instance().set(&DataKey::BountyCount, &0u32);
        env.storage().instance().set(&DataKey::TotalPaid, &0i128);
        extend_ttl(&env);

        publish(&env, symbol_short!("INIT"), (admin, token_contract));
    }

    pub fn post_bounty(
        env: Env,
        poster: Address,
        title: String,
        description: String,
        reward_xlm: i128,
    ) -> u32 {
        poster.require_auth();

        if reward_xlm <= 0 {
            panic!("invalid reward");
        }

        let next_id = get_bounty_count(&env) + 1;
        let bounty = Bounty {
            id: next_id,
            poster: poster.clone(),
            title,
            description,
            reward_xlm,
            status: BountyStatus::Open,
            worker: Option::None,
            created_at: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Bounty(next_id), &bounty);
        extend_bounty_ttl(&env, next_id);
        env.storage().instance().set(&DataKey::BountyCount, &next_id);
        extend_ttl(&env);

        publish(&env, symbol_short!("POSTED"), (poster, next_id, reward_xlm));
        next_id
    }

    pub fn claim_bounty(env: Env, worker: Address, bounty_id: u32) {
        worker.require_auth();

        let mut bounty = get_bounty_or_panic(&env, bounty_id);
        if bounty.status != BountyStatus::Open {
            panic!("not open");
        }
        if worker == bounty.poster {
            panic!("self claim");
        }

        bounty.status = BountyStatus::Claimed;
        bounty.worker = Option::Some(worker.clone());

        env.storage()
            .persistent()
            .set(&DataKey::Bounty(bounty_id), &bounty);
        extend_bounty_ttl(&env, bounty_id);
        extend_ttl(&env);

        publish(&env, symbol_short!("CLAIMED"), (worker, bounty_id));
    }

    pub fn approve_bounty(env: Env, poster: Address, bounty_id: u32) {
        poster.require_auth();

        let mut bounty = get_bounty_or_panic(&env, bounty_id);
        if bounty.status != BountyStatus::Claimed {
            panic!("not claimed");
        }
        if poster != bounty.poster {
            panic!("not poster");
        }

        let worker = bounty.worker.clone().unwrap();
        let token_contract = get_token_contract(&env);
        let bnt_amount = bounty.reward_xlm / 10;

        bounty.status = BountyStatus::Completed;
        env.storage()
            .persistent()
            .set(&DataKey::Bounty(bounty_id), &bounty);

        env.invoke_contract::<Val>(
            &token_contract,
            &symbol_short!("mint"),
            vec![
                &env,
                env.current_contract_address().into_val(&env),
                worker.clone().into_val(&env),
                bnt_amount.into_val(&env)
            ],
        );
        extend_bounty_ttl(&env, bounty_id);

        let total_paid: i128 = env.storage().instance().get(&DataKey::TotalPaid).unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalPaid, &(total_paid + bounty.reward_xlm));
        extend_ttl(&env);

        publish(
            &env,
            symbol_short!("APPROVED"),
            (poster, worker, bounty_id, bounty.reward_xlm),
        );
    }

    pub fn cancel_bounty(env: Env, poster: Address, bounty_id: u32) {
        poster.require_auth();

        let mut bounty = get_bounty_or_panic(&env, bounty_id);
        if bounty.status != BountyStatus::Open {
            panic!("not open");
        }
        if poster != bounty.poster {
            panic!("not poster");
        }

        bounty.status = BountyStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Bounty(bounty_id), &bounty);
        extend_bounty_ttl(&env, bounty_id);
        extend_ttl(&env);

        publish(&env, symbol_short!("CANCELLED"), (poster, bounty_id));
    }

    pub fn get_bounty(env: Env, id: u32) -> Bounty {
        get_bounty_or_panic(&env, id)
    }

    pub fn get_bounties(env: Env) -> Vec<Bounty> {
        let count = get_bounty_count(&env);
        let mut out = Vec::new(&env);

        let mut id = 1u32;
        while id <= count {
            if let Some(bounty) = env.storage().persistent().get(&DataKey::Bounty(id)) {
                out.push_back(bounty);
            }
            id += 1;
        }

        out
    }

    pub fn total_paid(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalPaid).unwrap_or(0)
    }

    pub fn bounty_count(env: Env) -> u32 {
        get_bounty_count(&env)
    }
}
