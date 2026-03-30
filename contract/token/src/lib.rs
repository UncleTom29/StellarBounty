#![no_std]
#![allow(unexpected_cfgs)]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, IntoVal, Map, String, Symbol,
    Val,
};

#[derive(Clone)]
#[contracttype]
pub struct TokenState {
    pub name: String,
    pub symbol: String,
    pub decimals: u32,
    pub total_supply: i128,
    pub balances: Map<Address, i128>,
    pub admin: Address,
    pub minter: Option<Address>,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    State,
}

#[contract]
pub struct BNTToken;

fn get_state(env: &Env) -> TokenState {
    env.storage()
        .instance()
        .get(&DataKey::State)
        .unwrap_or_else(|| panic!("not initialized"))
}

fn set_state(env: &Env, state: &TokenState) {
    env.storage().instance().set(&DataKey::State, state);
    env.storage().instance().extend_ttl(200_000, 200_000);
}

fn publish<T>(env: &Env, topic: Symbol, data: T)
where
    T: IntoVal<Env, Val>,
{
    env.events().publish((topic,), data);
}

#[contractimpl]
impl BNTToken {
    pub fn init(env: Env, admin: Address, name: String, symbol: String) {
        admin.require_auth();

        if env.storage().instance().has(&DataKey::State) {
            panic!("exists");
        }

        let state = TokenState {
            name,
            symbol,
            decimals: 7,
            total_supply: 0,
            balances: Map::new(&env),
            admin: admin.clone(),
            minter: None,
        };

        set_state(&env, &state);
        publish(&env, symbol_short!("INIT"), admin);
    }

    pub fn mint(env: Env, admin: Address, to: Address, amount: i128) {
        if amount <= 0 {
            panic!("invalid");
        }

        let mut state = get_state(&env);
        let is_admin = state.admin == admin;
        let is_minter = state
            .minter
            .clone()
            .map(|minter| minter == admin)
            .unwrap_or(false);

        if !is_admin && !is_minter {
            panic!("not admin");
        }

        admin.require_auth();

        let current = state.balances.get(to.clone()).unwrap_or(0);
        state.balances.set(to.clone(), current + amount);
        state.total_supply += amount;

        set_state(&env, &state);
        publish(&env, symbol_short!("MINT"), (to, amount));
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();

        if amount <= 0 {
            panic!("invalid");
        }

        let mut state = get_state(&env);
        let from_balance = state.balances.get(from.clone()).unwrap_or(0);
        if from_balance < amount {
            panic!("insufficient");
        }

        let to_balance = state.balances.get(to.clone()).unwrap_or(0);
        state.balances.set(from.clone(), from_balance - amount);
        state.balances.set(to.clone(), to_balance + amount);

        set_state(&env, &state);
        publish(&env, symbol_short!("XFER"), (from, to, amount));
    }

    pub fn set_minter(env: Env, admin: Address, minter: Address) {
        admin.require_auth();

        let mut state = get_state(&env);
        if state.admin != admin {
            panic!("not admin");
        }

        state.minter = Some(minter.clone());
        set_state(&env, &state);
        publish(&env, symbol_short!("MINTER"), minter);
    }

    pub fn balance(env: Env, addr: Address) -> i128 {
        let state = get_state(&env);
        state.balances.get(addr).unwrap_or(0)
    }

    pub fn symbol(env: Env) -> String {
        get_state(&env).symbol
    }

    pub fn name(env: Env) -> String {
        get_state(&env).name
    }

    pub fn total_supply(env: Env) -> i128 {
        get_state(&env).total_supply
    }
}
